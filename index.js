require('dotenv').config();
const {
    Client, Events, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActivityType,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags
} = require('discord.js');
const { fetchStatus } = require('./status');
const { loadPanel, savePanel, statusKey } = require('./panel');
const { acquire } = require('./lock');

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, ANNOUNCE_CHANNEL_ID, SITE_URL } = process.env;
const POLL_SECONDS = Math.max(15, parseInt(process.env.POLL_SECONDS || '30', 10) || 30);

if (!DISCORD_TOKEN || !CLIENT_ID) {
    console.error('Il manque DISCORD_TOKEN ou CLIENT_ID dans le fichier .env (voir .env.example).');
    process.exit(1);
}

const OPEN_COLOR = 0x34d399;
const CLOSED_COLOR = 0xf87171;

function buildEmbed(status) {
    const embed = new EmbedBuilder()
        .setColor(status.closed ? CLOSED_COLOR : OPEN_COLOR)
        .setTitle(status.closed ? '🔒 Candidatures fermées' : '✅ Candidatures ouvertes')
        .setDescription(status.closed
            ? "Il n'est plus possible d'envoyer de candidature pour le moment. Reviens plus tard !"
            : 'Tu peux envoyer ta candidature de modérateur dès maintenant.')
        .setTimestamp();
    if (status.updatedAt) {
        const unix = Math.floor(status.updatedAt.getTime() / 1000);
        embed.addFields({ name: 'Dernier changement', value: '<t:' + unix + ':F> (<t:' + unix + ':R>)' });
    }
    return embed;
}

function buildComponents() {
    if (!SITE_URL) return [];
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Ouvrir le site').setStyle(ButtonStyle.Link).setURL(SITE_URL)
    )];
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let lastClosed = null;      // dernier état connu (null = pas encore lu)
let shownKey = null;        // ce que le panneau affiche actuellement
let polling = false;
let creatingPanel = false;  // vrai pendant /panneau : évite que la mise à jour automatique se mélange

function updatePresence(status) {
    client.user.setPresence({
        status: status.closed ? 'dnd' : 'online',
        activities: [{ name: status.closed ? 'Candidatures fermées' : 'Candidatures ouvertes', type: ActivityType.Watching }]
    });
}

// Met à jour le panneau (le message modifié automatiquement) s'il existe et s'il n'est pas à jour
async function syncPanel(status) {
    if (creatingPanel) return;
    const panel = loadPanel();
    if (!panel) return;
    const key = statusKey(status);
    if (key === shownKey) return;
    try {
        const channel = await client.channels.fetch(panel.channelId);
        await channel.messages.edit(panel.messageId, { embeds: [buildEmbed(status)], components: buildComponents() });
        shownKey = key;
        console.log('[' + new Date().toLocaleTimeString() + '] Panneau mis à jour : ' + (status.closed ? 'fermées' : 'ouvertes'));
    } catch (e) {
        // 10008 = message supprimé, 10003 = salon supprimé : le panneau n'existe plus
        if (e.code === 10008 || e.code === 10003) {
            savePanel(null);
            console.warn("Le panneau a été supprimé sur Discord. Retape /panneau pour en créer un nouveau.");
        } else {
            console.warn('Mise à jour du panneau impossible (permissions du salon ?) :', e.message);
        }
    }
}

async function poll() {
    if (polling) return;
    polling = true;
    try {
        const status = await fetchStatus();
        updatePresence(status);
        await syncPanel(status);
        // Annonce automatique (message neuf dans un salon) quand l'état change.
        // Pas d'annonce si le panneau est dans ce même salon : il se modifie déjà, une annonce ferait un doublon.
        const panel = loadPanel();
        const panelIsThere = panel && panel.channelId === ANNOUNCE_CHANNEL_ID;
        if (lastClosed !== null && lastClosed !== status.closed && ANNOUNCE_CHANNEL_ID && !panelIsThere) {
            try {
                const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);
                if (channel && channel.isTextBased()) {
                    await channel.send({ embeds: [buildEmbed(status)], components: buildComponents() });
                }
            } catch (e) {
                console.warn("Annonce impossible (salon introuvable ou permissions manquantes) :", e.message);
            }
        }
        lastClosed = status.closed;
    } catch (e) {
        console.warn("Lecture de l'état impossible :", e.message);
    } finally {
        polling = false;
    }
}

async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('candidatures')
            .setDescription('Indique si les candidatures de modérateur sont ouvertes ou fermées')
            .toJSON(),
        new SlashCommandBuilder()
            .setName('panneau')
            .setDescription('Poste dans ce salon un message qui se met à jour tout seul (ouvert / fermé)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
            .setDMPermission(false)
            .toJSON()
    ];
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    if (GUILD_ID) {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Commandes /candidatures et /panneau enregistrées sur le serveur ' + GUILD_ID);
    } else {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log("Commandes enregistrées globalement (peut mettre jusqu'à 1 h à apparaître).");
    }
}

client.once(Events.ClientReady, async () => {
    console.log('Connecté en tant que ' + client.user.tag);
    await poll();
    setInterval(poll, POLL_SECONDS * 1000);
});

async function handleCandidatures(interaction) {
    console.log('[' + new Date().toLocaleTimeString() + '] /candidatures reçue de ' + interaction.user.tag);
    try {
        // On répond « en cours » tout de suite : Discord abandonne après 3 secondes sans réponse
        await interaction.deferReply();
    } catch (e) {
        console.error("Impossible de répondre à Discord (délai dépassé ou bot lancé 2 fois ?) :", e.message);
        return;
    }
    try {
        const status = await fetchStatus();
        await interaction.editReply({ embeds: [buildEmbed(status)], components: buildComponents() });
        console.log('  -> réponse envoyée : ' + (status.closed ? 'fermées' : 'ouvertes'));
    } catch (e) {
        console.warn('/candidatures a échoué :', e.message);
        await interaction.editReply("Je n'arrive pas à lire l'état des candidatures pour le moment. Réessaie dans un instant.").catch(() => {});
    }
}

// Supprime les messages « Candidatures ouvertes/fermées » postés par le bot dans ce salon, sauf le panneau
async function cleanDuplicates(channel, keepId) {
    try {
        const messages = await channel.messages.fetch({ limit: 50 });
        for (const m of messages.values()) {
            if (m.id === keepId || m.author.id !== client.user.id) continue;
            const title = m.embeds[0] && m.embeds[0].title;
            if (title && /Candidatures (ouvertes|fermées)/.test(title)) await m.delete().catch(() => {});
        }
    } catch (e) { /* pas le droit de lire l'historique du salon : tant pis */ }
}

async function handlePanneau(interaction) {
    console.log('[' + new Date().toLocaleTimeString() + '] /panneau reçue de ' + interaction.user.tag);
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (e) {
        console.error("Impossible de répondre à Discord :", e.message);
        return;
    }
    if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.editReply("Seuls les membres qui peuvent gérer le serveur peuvent créer le panneau.").catch(() => {});
        return;
    }
    // 1) Droits du bot DANS ce salon (peuvent différer de ceux du serveur : catégorie, règles du salon…)
    const needed = [
        [PermissionFlagsBits.ViewChannel, 'Voir le salon'],
        [PermissionFlagsBits.SendMessages, 'Envoyer des messages'],
        [PermissionFlagsBits.EmbedLinks, 'Intégrer des liens']
    ];
    const have = interaction.appPermissions;
    if (have) {
        const missing = needed.filter(([flag]) => !have.has(flag)).map(([, name]) => name);
        if (missing.length) {
            console.warn('  -> droits manquants dans ce salon : ' + missing.join(', '));
            await interaction.editReply("Il me manque ces droits **dans ce salon** : " + missing.join(', ') +
                ".\nAttention : les droits du salon (ou de sa catégorie) peuvent bloquer ceux du serveur. " +
                "Clic droit sur le salon > Modifier le salon > Permissions > ajoute le bot et mets une coche verte sur ces droits.").catch(() => {});
            return;
        }
    }

    // 2) Lecture de l'état du site
    let status;
    try {
        status = await fetchStatus();
    } catch (e) {
        console.warn('/panneau : lecture du site impossible :', e.message);
        await interaction.editReply("Je n'arrive pas à lire l'état du site pour le moment. Réessaie dans un instant.").catch(() => {});
        return;
    }

    // 3) Envoi du message (le salon est recherché par son identifiant : interaction.channel peut être vide)
    if (creatingPanel) {
        await interaction.editReply("Un panneau est déjà en cours de création, patiente un instant.").catch(() => {});
        return;
    }
    creatingPanel = true;
    try {
        const channel = interaction.channel || await client.channels.fetch(interaction.channelId);
        const payload = { embeds: [buildEmbed(status)], components: buildComponents() };
        const old = loadPanel();
        let panelId = null;

        // Panneau déjà dans ce salon : on le MODIFIE au lieu d'en poster un deuxième
        if (old && old.channelId === channel.id) {
            try {
                await channel.messages.edit(old.messageId, payload);
                panelId = old.messageId;
            } catch (e) { /* message supprimé : on en crée un nouveau juste après */ }
        }
        if (!panelId) {
            // Message normal du bot (pas une réponse) : il reste modifiable sans limite de temps
            const sent = await channel.send(payload);
            panelId = sent.id;
            // Ancien panneau dans un autre salon : on le supprime pour n'en garder qu'un seul
            if (old && old.channelId !== channel.id) {
                try {
                    const oldChannel = await client.channels.fetch(old.channelId);
                    await oldChannel.messages.delete(old.messageId);
                } catch (e) { /* déjà supprimé ou inaccessible : tant pis */ }
            }
        }
        // Nettoie les anciens messages « Candidatures ouvertes/fermées » du bot restés dans ce salon
        await cleanDuplicates(channel, panelId);
        savePanel({ channelId: channel.id, messageId: panelId });
        shownKey = statusKey(status);
        console.log('  -> panneau créé dans #' + (channel.name || channel.id));
        await interaction.editReply('✅ Panneau créé. Il se mettra à jour tout seul (environ toutes les ' + POLL_SECONDS + ' secondes) quand tu ouvres ou fermes les candidatures sur le site.');
    } catch (e) {
        console.warn('/panneau a échoué (code ' + e.code + ') :', e.message);
        const hint = e.code === 50013 ? "Il me manque un droit dans ce salon (50013)."
            : e.code === 50001 ? "Je n'ai pas accès à ce salon (50001) : donne-moi « Voir le salon »."
            : "Erreur Discord : " + (e.code ? e.code + ' - ' : '') + e.message;
        await interaction.editReply("Je n'ai pas pu créer le panneau. " + hint).catch(() => {});
    } finally {
        creatingPanel = false;
    }
}

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'candidatures') return handleCandidatures(interaction);
    if (interaction.commandName === 'panneau') return handlePanneau(interaction);
});

// Une erreur imprévue ne doit jamais arrêter le bot en silence
client.on(Events.Error, e => console.error('Erreur Discord :', e.message));
process.on('unhandledRejection', e => console.error('Erreur non gérée :', e && e.message ? e.message : e));

(async () => {
    // Une seule copie du bot à la fois (sinon chaque copie répond et poste son message : doublons)
    const lock = await acquire();
    if (!lock.ok) {
        console.error('Le bot tourne déjà (pid ' + lock.pid + '). Je ne lance pas une 2e copie. Arrête l\'autre avec « npm run stop ».');
        process.exit(1);
    }
    try { await registerCommands(); }
    catch (e) { console.error("Impossible d'enregistrer les commandes :", e.message); }
    await client.login(DISCORD_TOKEN);
})();
