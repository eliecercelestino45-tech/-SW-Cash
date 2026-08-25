require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");

const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    REST,
    Routes,
    MessageFlags
} = require("discord.js");

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
    console.error("❌ Falta TOKEN en las variables de entorno.");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("❌ Falta CLIENT_ID en las variables de entorno.");
    process.exit(1);
}

// ============================================================
// SERVIDOR WEB PARA RENDER
// ============================================================

const app = express();

app.get("/", (req, res) => {
    res.status(200).send("🟣 SW Economy está funcionando correctamente.");
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "online",
        bot: "SW Economy"
    });
});

app.listen(PORT, () => {
    console.log(`🌐 PORT ${PORT} iniciado correctamente.`);
});

// ============================================================
// CARPETA DATA
// ============================================================

const DATA_DIR = path.join(__dirname, "data");
const ECONOMY_FILE = path.join(DATA_DIR, "economy.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(ECONOMY_FILE)) {
    fs.writeFileSync(
        ECONOMY_FILE,
        JSON.stringify({ guilds: {}, users: {} }, null, 2)
    );
}

// ============================================================
// JSON
// ============================================================

function readData() {
    try {
        const raw = fs.readFileSync(ECONOMY_FILE, "utf8");

        if (!raw.trim()) {
            return { guilds: {}, users: {} };
        }

        const data = JSON.parse(raw);

        if (!data.guilds) data.guilds = {};
        if (!data.users) data.users = {};

        return data;
    } catch (error) {
        console.error("❌ Error leyendo economy.json:", error);
        return { guilds: {}, users: {} };
    }
}

function writeData(data) {
    try {
        const tempFile = ECONOMY_FILE + ".tmp";

        fs.writeFileSync(
            tempFile,
            JSON.stringify(data, null, 2)
        );

        fs.renameSync(tempFile, ECONOMY_FILE);
    } catch (error) {
        console.error("❌ Error guardando economy.json:", error);
    }
}

function getGuildConfig(guildId) {
    const data = readData();

    if (!data.guilds[guildId]) {
        data.guilds[guildId] = createDefaultGuildConfig();
        writeData(data);
    }

    return data.guilds[guildId];
}

function createDefaultGuildConfig() {
    return {
        enabled: true,

        budget: 10000000000,
        currencyName: "Social Cash",
        currencyEmoji: "💰",

        prefix: "!",

        initialBalance: 1000,

        daily: {
            enabled: true,
            min: 500,
            max: 1500,
            cooldown: 86400000
        },

        work: {
            enabled: true,
            min: 100,
            max: 500,
            cooldown: 3600000
        },

        systems: {
            pay: true,
            leaderboard: true,
            profile: true,
            stats: true,
            loans: true
        },

        channels: {
            economy: null,
            logs: null,
            loans: null
        },

        staffRole: null,

        treasury: {
            budget: 10000000000,
            generated: 0,
            spent: 0,
            transferred: 0
        },

        loans: {
            enabled: true,
            active: null,
            codes: {}
        },

        setup: {
            completed: false
        }
    };
}

// ============================================================
// USUARIOS
// ============================================================

function getUser(guildId, userId) {
    const data = readData();

    if (!data.users[guildId]) {
        data.users[guildId] = {};
    }

    if (!data.users[guildId][userId]) {
        const config = getGuildConfig(guildId);

        data.users[guildId][userId] = {
            balance: config.initialBalance || 1000,
            earned: 0,
            spent: 0,
            dailyUses: 0,
            workUses: 0,
            lastDaily: 0,
            lastWork: 0
        };

        writeData(data);
    }

    return data.users[guildId][userId];
}

function saveUser(guildId, userId, user) {
    const data = readData();

    if (!data.users[guildId]) {
        data.users[guildId] = {};
    }

    data.users[guildId][userId] = user;

    writeData(data);
}

// ============================================================
// CLIENT
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],

    partials: [
        Partials.Channel
    ]
});

// ============================================================
// SETUPS ACTIVOS
// ============================================================

const setupSessions = new Map();

// ============================================================
// UTILIDADES
// ============================================================

function money(value) {
    return Number(value || 0).toLocaleString("en-US");
}

function randomNumber(min, max) {
    min = Number(min);
    max = Number(max);

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}

function getEmoji(config) {
    return config.currencyEmoji || "💰";
}

function getCurrency(config) {
    return config.currencyName || "Social Cash";
}

function hasStaffPermission(member, config) {
    if (!member) return false;

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    if (
        config.staffRole &&
        member.roles.cache.has(config.staffRole)
    ) {
        return true;
    }

    return false;
}

async function sendLog(guild, title, description) {
    try {
        const config = getGuildConfig(guild.id);

        if (!config.channels.logs) return;

        const channel = guild.channels.cache.get(
            config.channels.logs
        );

        if (!channel || !channel.isTextBased()) return;

        const embed = new EmbedBuilder()
            .setColor(0x7c3aed)
            .setTitle(title)
            .setDescription(description)
            .setFooter({
                text: "SW Economy • Logs"
            })
            .setTimestamp();

        await channel.send({
            embeds: [embed]
        });
    } catch (error) {
        console.error("❌ Error enviando log:", error);
    }
}

// ============================================================
// SETUP EMBEDS
// ============================================================

function setupEmbed(session) {
    const config = session.config;
    const step = session.step;

    const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle("꒰ 💰 ꒱ SOCIAL WORLD ECONOMY")
        .setFooter({
            text: `Configuración • Paso ${step}/6`
        })
        .setTimestamp();

    if (step === 1) {
        embed
            .setDescription(
                [
                    "## ⚙️ CONFIGURACIÓN GENERAL",
                    "",
                    `🟢 **Economía:** ${config.enabled ? "Activada" : "Desactivada"}`,
                    `💰 **Presupuesto:** $${money(config.budget)} USD`,
                    `⌨️ **Prefijo:** \`${config.prefix}\``,
                    "",
                    "Configura el presupuesto y el prefijo que utilizarán los comandos de economía."
                ].join("\n")
            );
    }

    if (step === 2) {
        embed
            .setDescription(
                [
                    "## 💵 CONFIGURACIÓN DE MONEDA",
                    "",
                    `💵 **Nombre:** ${config.currencyName}`,
                    `🎨 **Emoji:** ${config.currencyEmoji}`,
                    "",
                    `Ejemplo: ${config.currencyEmoji} 10,000 ${config.currencyName}`
                ].join("\n")
            );
    }

    if (step === 3) {
        embed
            .setDescription(
                [
                    "## 🎁 RECOMPENSAS",
                    "",
                    `💰 **Balance inicial:** ${money(config.initialBalance)}`,
                    "",
                    `🎁 **Daily:** ${money(config.daily.min)} — ${money(config.daily.max)}`,
                    `💼 **Work:** ${money(config.work.min)} — ${money(config.work.max)}`,
                    "",
                    `🎁 Daily: ${config.daily.enabled ? "🟢" : "🔴"}`,
                    `💼 Work: ${config.work.enabled ? "🟢" : "🔴"}`
                ].join("\n")
            );
    }

    if (step === 4) {
        embed
            .setDescription(
                [
                    "## 📢 CANALES",
                    "",
                    `💰 **Economía:** ${config.channels.economy ? `<#${config.channels.economy}>` : "❌ No configurado"}`,
                    `📋 **Logs:** ${config.channels.logs ? `<#${config.channels.logs}>` : "❌ No configurado"}`,
                    `🏦 **Préstamos:** ${config.channels.loans ? `<#${config.channels.loans}>` : "❌ No configurado"}`,
                    "",
                    "Utiliza los selectores para buscar y seleccionar los canales."
                ].join("\n")
            );
    }

    if (step === 5) {
        embed
            .setDescription(
                [
                    "## ⚙️ SISTEMAS",
                    "",
                    `💸 Pay: ${config.systems.pay ? "🟢" : "🔴"}`,
                    `🏆 Leaderboard: ${config.systems.leaderboard ? "🟢" : "🔴"}`,
                    `👤 Profile: ${config.systems.profile ? "🟢" : "🔴"}`,
                    `📊 Stats: ${config.systems.stats ? "🟢" : "🔴"}`,
                    `🏦 Préstamos: ${config.systems.loans ? "🟢" : "🔴"}`,
                    "",
                    "Puedes activar o desactivar cada sistema."
                ].join("\n")
            );
    }

    if (step === 6) {
        embed
            .setDescription(
                [
                    "## 🛡️ STAFF + LOGS",
                    "",
                    `🛡️ **Staff Economy:** ${config.staffRole ? `<@&${config.staffRole}>` : "❌ No configurado"}`,
                    `📋 **Canal de logs:** ${config.channels.logs ? `<#${config.channels.logs}>` : "❌ No configurado"}`,
                    "",
                    "El Staff Economy podrá administrar los balances.",
                    "",
                    "Los logs registrarán:",
                    "• 💰 Añadir dinero",
                    "• 💸 Quitar dinero",
                    "• 🔄 Cambios de balance",
                    "• 🎁 Recompensas",
                    "• 💳 Transferencias",
                    "• 🏦 Préstamos",
                    "• ⚙️ Cambios de configuración"
                ].join("\n")
            );
    }

    return embed;
}

// ============================================================
// SETUP COMPONENTES
// ============================================================

function setupComponents(session) {
    const rows = [];

    if (session.step === 1) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("setup_budget")
                    .setLabel("💰 Presupuesto")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("setup_prefix")
                    .setLabel("⌨️ Prefijo")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("setup_toggle")
                    .setLabel(
                        session.config.enabled
                            ? "🟢 Economía"
                            : "🔴 Economía"
                    )
                    .setStyle(
                        session.config.enabled
                            ? ButtonStyle.Success
                            : ButtonStyle.Danger
                    )
            )
        );
    }

    if (session.step === 2) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("setup_currency_name")
                    .setLabel("💵 Editar nombre")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("setup_currency_emoji")
                    .setLabel("🎨 Editar emoji")
                    .setStyle(ButtonStyle.Secondary)
            )
        );
    }

    if (session.step === 3) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("setup_initial")
                    .setLabel("💰 Balance inicial")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("setup_daily")
                    .setLabel("🎁 Daily")
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("setup_work")
                    .setLabel("💼 Work")
                    .setStyle(ButtonStyle.Secondary)
            )
        );
    }

    if (session.step === 4) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId("setup_channel_economy")
                    .setPlaceholder("💰 Seleccionar canal de economía")
                    .setChannelTypes(0)
            )
        );

        rows.push(
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId("setup_channel_logs")
                    .setPlaceholder("📋 Seleccionar canal de logs")
                    .setChannelTypes(0)
            )
        );

        rows.push(
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId("setup_channel_loans")
                    .setPlaceholder("🏦 Seleccionar canal de préstamos")
                    .setChannelTypes(0)
            )
        );
    }

    if (session.step === 5) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("system_pay")
                    .setLabel(
                        session.config.systems.pay
                            ? "🟢 Pay"
                            : "🔴 Pay"
                    )
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("system_leaderboard")
                    .setLabel(
                        session.config.systems.leaderboard
                            ? "🟢 Leaderboard"
                            : "🔴 Leaderboard"
                    )
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("system_profile")
                    .setLabel(
                        session.config.systems.profile
                            ? "🟢 Profile"
                            : "🔴 Profile"
                    )
                    .setStyle(ButtonStyle.Secondary)
            )
        );

        rows.push(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("system_stats")
                    .setLabel(
                        session.config.systems.stats
                            ? "🟢 Stats"
                            : "🔴 Stats"
                    )
                    .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                    .setCustomId("system_loans")
                    .setLabel(
                        session.config.systems.loans
                            ? "🟢 Préstamos"
                            : "🔴 Préstamos"
                    )
                    .setStyle(ButtonStyle.Secondary)
            )
        );
    }

    if (session.step === 6) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId("setup_staff_role")
                    .setPlaceholder("🛡️ Buscar rol Staff Economy")
                    .setMinValues(1)
                    .setMaxValues(1)
            )
        );

        rows.push(
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId("setup_logs_final")
                    .setPlaceholder("📋 Buscar canal de logs")
                    .setChannelTypes(0)
            )
        );
    }

    rows.push(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("setup_cancel")
                .setLabel("✕")
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId("setup_back")
                .setLabel("◀ Atrás")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(session.step === 1),

            new ButtonBuilder()
                .setCustomId(
                    session.step === 6
                        ? "setup_finish"
                        : "setup_next"
                )
                .setLabel(
                    session.step === 6
                        ? "🚀 Finalizar"
                        : "Siguiente ➜"
                )
                .setStyle(ButtonStyle.Primary)
        )
    );

    return rows;
}

// ============================================================
// MODALES
// ============================================================

function createModal(id, title, label, placeholder, value = "") {
    const modal = new ModalBuilder()
        .setCustomId(id)
        .setTitle(title);

    const input = new TextInputBuilder()
        .setCustomId("value")
        .setLabel(label)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(placeholder)
        .setValue(String(value).slice(0, 4000));

    modal.addComponents(
        new ActionRowBuilder().addComponents(input)
    );

    return modal;
}

// ============================================================
// COMANDOS
// ============================================================

const commands = [
    {
        name: "setup",
        description: "Configura el sistema de economía",
        options: [
            {
                type: 1,
                name: "eco",
                description: "Configurar economía"
            }
        ]
    },

    {
        name: "balance",
        description: "Consulta tu balance",
        options: [
            {
                type: 6,
                name: "usuario",
                description: "Usuario a consultar",
                required: false
            }
        ]
    },

    {
        name: "profile",
        description: "Muestra tu perfil económico"
    },

    {
        name: "daily",
        description: "Reclama tu recompensa diaria"
    },

    {
        name: "work",
        description: "Trabaja y gana dinero"
    },

    {
        name: "pay",
        description: "Envía dinero a otro usuario",
        options: [
            {
                type: 6,
                name: "usuario",
                description: "Usuario destinatario",
                required: true
            },
            {
                type: 10,
                name: "cantidad",
                description: "Cantidad a enviar",
                required: true
            }
        ]
    },

    {
        name: "leaderboard",
        description: "Muestra el ranking económico"
    },

    {
        name: "economy",
        description: "Muestra la configuración económica"
    },

    {
        name: "guia",
        description: "Recibe la guía de SW Economy por MD"
    },

    {
        name: "eco",
        description: "Administración de economía",
        options: [
            {
                type: 1,
                name: "add",
                description: "Añadir dinero",
                options: [
                    {
                        type: 6,
                        name: "usuario",
                        description: "Usuario",
                        required: true
                    },
                    {
                        type: 10,
                        name: "cantidad",
                        description: "Cantidad",
                        required: true
                    }
                ]
            },

            {
                type: 1,
                name: "remove",
                description: "Quitar dinero",
                options: [
                    {
                        type: 6,
                        name: "usuario",
                        description: "Usuario",
                        required: true
                    },
                    {
                        type: 10,
                        name: "cantidad",
                        description: "Cantidad",
                        required: true
                    }
                ]
            },

            {
                type: 1,
                name: "set",
                description: "Establecer balance",
                options: [
                    {
                        type: 6,
                        name: "usuario",
                        description: "Usuario",
                        required: true
                    },
                    {
                        type: 10,
                        name: "cantidad",
                        description: "Cantidad",
                        required: true
                    }
                ]
            },

            {
                type: 1,
                name: "reset",
                description: "Reiniciar balance",
                options: [
                    {
                        type: 6,
                        name: "usuario",
                        description: "Usuario",
                        required: true
                    }
                ]
            },

            {
                type: 1,
                name: "giveall",
                description: "Dar dinero a usuarios",
                options: [
                    {
                        type: 10,
                        name: "cantidad",
                        description: "Cantidad",
                        required: true
                    }
                ]
            },

            {
                type: 1,
                name: "stats",
                description: "Estadísticas económicas"
            }
        ]
    }
];

// ============================================================
// REGISTRO GLOBAL
// ============================================================

async function registerCommands() {
    try {
        const rest = new REST({
            version: "10"
        }).setToken(TOKEN);

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: commands
            }
        );

        console.log(
            `✅ ${commands.length} comandos globales registrados.`
        );
    } catch (error) {
        console.error(
            "❌ Error registrando comandos:",
            error
        );
    }
}

// ============================================================
// READY
// ============================================================

client.once("clientReady", async () => {
    console.log("");
    console.log("================================");
    console.log("🟣 SOCIAL WORLD");
    console.log("================================");
    console.log(
        `🤖 Bot: ${client.user.tag}`
    );
    console.log(
        `🌎 Servidores: ${client.guilds.cache.size}`
    );
    console.log(
        "🌎 Registrando comandos globales..."
    );

    await registerCommands();
});

// ============================================================
// INTERACCIONES
// ============================================================

client.on("interactionCreate", async interaction => {

    // ========================================================
    // SLASH COMMANDS
    // ========================================================

    if (interaction.isChatInputCommand()) {

        // ----------------------------------------------------
        // /setup eco
        // ----------------------------------------------------

        if (
            interaction.commandName === "setup" &&
            interaction.options.getSubcommand() === "eco"
        ) {
            if (
                !interaction.memberPermissions.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Necesitas el permiso **Administrar servidor** para utilizar este comando.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const guild = interaction.guild;

            const existing = [...setupSessions.values()]
                .find(
                    s =>
                        s.guildId === guild.id &&
                        s.userId === interaction.user.id
                );

            if (existing) {
                return interaction.reply({
                    content:
                        `⚠️ Ya tienes un setup abierto en <#${existing.channelId}>.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const setupChannel = await guild.channels.create({
                name: `🔧・setup-economia`,
                type: 0,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [
                            PermissionFlagsBits.ViewChannel
                        ]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.ManageMessages
                        ]
                    }
                ]
            });

            const config = getGuildConfig(guild.id);

            const session = {
                guildId: guild.id,
                userId: interaction.user.id,
                channelId: setupChannel.id,
                step: 1,
                config: JSON.parse(
                    JSON.stringify(config)
                )
            };

            setupSessions.set(
                `${guild.id}:${interaction.user.id}`,
                session
            );

            await interaction.reply({
                content:
                    `✅ Creé tu canal privado de configuración: <#${setupChannel.id}>`,
                flags: MessageFlags.Ephemeral
            });

            await setupChannel.send({
                content: `<@${interaction.user.id}>`,
                embeds: [
                    setupEmbed(session)
                ],
                components: setupComponents(session)
            });

            return;
        }

        // ----------------------------------------------------
        // /balance
        // ----------------------------------------------------

        if (interaction.commandName === "balance") {

            const config = getGuildConfig(
                interaction.guild.id
            );

            const target =
                interaction.options.getUser("usuario") ||
                interaction.user;

            const user = getUser(
                interaction.guild.id,
                target.id
            );

            const embed = new EmbedBuilder()
                .setColor(0x7c3aed)
                .setTitle(
                    `💰 Balance de ${target.username}`
                )
                .setDescription(
                    [
                        `${getEmoji(config)} **Dinero:** ${money(user.balance)} ${getCurrency(config)}`,
                        "",
                        `📈 **Ganado:** ${money(user.earned)}`,
                        `📉 **Gastado:** ${money(user.spent)}`
                    ].join("\n")
                );

            return interaction.reply({
                embeds: [embed]
            });
        }

        // ----------------------------------------------------
        // /profile
        // ----------------------------------------------------

        if (interaction.commandName === "profile") {

            const config = getGuildConfig(
                interaction.guild.id
            );

            const user = getUser(
                interaction.guild.id,
                interaction.user.id
            );

            const embed = new EmbedBuilder()
                .setColor(0x7c3aed)
                .setTitle(
                    `👤 Perfil económico • ${interaction.user.username}`
                )
                .setDescription(
                    [
                        `${getEmoji(config)} **Balance:** ${money(user.balance)}`,
                        `📈 **Ganado:** ${money(user.earned)}`,
                        `📉 **Gastado:** ${money(user.spent)}`,
                        `🎁 **Daily:** ${user.dailyUses}`,
                        `💼 **Work:** ${user.workUses}`
                    ].join("\n")
                );

            return interaction.reply({
                embeds: [embed]
            });
        }

        // ----------------------------------------------------
        // /daily
        // ----------------------------------------------------

        if (interaction.commandName === "daily") {

            const config = getGuildConfig(
                interaction.guild.id
            );

            if (!config.daily.enabled) {
                return interaction.reply({
                    content:
                        "❌ El sistema Daily está desactivado.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const user = getUser(
                interaction.guild.id,
                interaction.user.id
            );

            const now = Date.now();

            if (
                now - user.lastDaily <
                config.daily.cooldown
            ) {
                const remaining =
                    config.daily.cooldown -
                    (now - user.lastDaily);

                const hours =
                    Math.ceil(
                        remaining / 3600000
                    );

                return interaction.reply({
                    content:
                        `⏰ Tu Daily estará disponible aproximadamente en **${hours} hora(s)**.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const reward = randomNumber(
                config.daily.min,
                config.daily.max
            );

            if (
                config.treasury.budget <
                reward
            ) {
                return interaction.reply({
                    content:
                        "🚨 La tesorería del servidor no tiene suficientes fondos para entregar este Daily.",
                    flags: MessageFlags.Ephemeral
                });
            }

            user.balance += reward;
            user.earned += reward;
            user.dailyUses++;
            user.lastDaily = now;

            config.treasury.budget -= reward;
            config.treasury.spent += reward;

            const data = readData();

            data.users[interaction.guild.id][
                interaction.user.id
            ] = user;

            data.guilds[interaction.guild.id] =
                config;

            writeData(data);

            await sendLog(
                interaction.guild,
                "🎁 Daily reclamado",
                `👤 Usuario: ${interaction.user}\n💰 Cantidad: ${money(reward)} ${getCurrency(config)}`
            );

            return interaction.reply({
                content:
                    `🎁 **DAILY RECLAMADO**\n\n${getEmoji(config)} Has recibido **${money(reward)} ${getCurrency(config)}**.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // ----------------------------------------------------
        // /work
        // ----------------------------------------------------

        if (interaction.commandName === "work") {

            const config = getGuildConfig(
                interaction.guild.id
            );

            if (!config.work.enabled) {
                return interaction.reply({
                    content:
                        "❌ El sistema Work está desactivado.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const user = getUser(
                interaction.guild.id,
                interaction.user.id
            );

            const now = Date.now();

            if (
                now - user.lastWork <
                config.work.cooldown
            ) {
                const remaining =
                    config.work.cooldown -
                    (now - user.lastWork);

                const minutes =
                    Math.ceil(
                        remaining / 60000
                    );

                return interaction.reply({
                    content:
                        `⏰ Podrás trabajar nuevamente en aproximadamente **${minutes} minuto(s)**.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            const reward = randomNumber(
                config.work.min,
                config.work.max
            );

            if (
                config.treasury.budget <
                reward
            ) {
                return interaction.reply({
                    content:
                        "🚨 La tesorería no tiene fondos suficientes.",
                    flags: MessageFlags.Ephemeral
                });
            }

            user.balance += reward;
            user.earned += reward;
            user.workUses++;
            user.lastWork = now;

            config.treasury.budget -= reward;
            config.treasury.spent += reward;

            const data = readData();

            data.users[interaction.guild.id][
                interaction.user.id
            ] = user;

            data.guilds[interaction.guild.id] =
                config;

            writeData(data);

            await sendLog(
                interaction.guild,
                "💼 Work realizado",
                `👤 Usuario: ${interaction.user}\n💰 Ganancia: ${money(reward)} ${getCurrency(config)}`
            );

            return interaction.reply({
                content:
                    `💼 **TRABAJO COMPLETADO**\n\n${getEmoji(config)} Has ganado **${money(reward)} ${getCurrency(config)}**.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // ----------------------------------------------------
        // /pay
        // ----------------------------------------------------

        if (interaction.commandName === "pay") {

            const config = getGuildConfig(
                interaction.guild.id
            );

            if (!config.systems.pay) {
                return interaction.reply({
                    content:
                        "❌ Pay está desactivado.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const target =
                interaction.options.getUser(
                    "usuario"
                );

            const amount =
                interaction.options.getNumber(
                    "cantidad"
                );

            if (target.bot) {
                return interaction.reply({
                    content:
                        "❌ No puedes enviar dinero a bots.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (
                target.id ===
                interaction.user.id
            ) {
                return interaction.reply({
                    content:
                        "❌ No puedes enviarte dinero a ti mismo.",
                    flags: MessageFlags.Ephemeral
                });
            }

            if (
                !Number.isFinite(amount) ||
                amount <= 0
            ) {
                return interaction.reply({
                    content:
                        "❌ La cantidad debe ser mayor que 0.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const sender = getUser(
                interaction.guild.id,
                interaction.user.id
            );

            const receiver = getUser(
                interaction.guild.id,
                target.id
            );

            if (sender.balance < amount) {
                return interaction.reply({
                    content:
                        "❌ No tienes suficiente dinero.",
                    flags: MessageFlags.Ephemeral
                });
            }

            sender.balance -= amount;
            sender.spent += amount;

            receiver.balance += amount;

            const data = readData();

            data.users[interaction.guild.id][
                interaction.user.id
            ] = sender;

            data.users[interaction.guild.id][
                target.id
            ] = receiver;

            data.guilds[interaction.guild.id]
                .treasury.transferred += amount;

            writeData(data);

            await sendLog(
                interaction.guild,
                "💸 Transferencia",
                [
                    `👤 De: ${interaction.user}`,
                    `👤 Para: ${target}`,
                    `💰 Cantidad: ${money(amount)} ${getCurrency(config)}`
                ].join("\n")
            );

            return interaction.reply({
                content:
                    `💸 Enviaste **${money(amount)} ${getCurrency(config)}** a ${target}.`,
                flags: MessageFlags.Ephemeral
            });
        }

        // ----------------------------------------------------
        // /leaderboard
        // ----------------------------------------------------

        if (
            interaction.commandName ===
            "leaderboard"
        ) {

            const config = getGuildConfig(
                interaction.guild.id
            );

            if (!config.systems.leaderboard) {
                return interaction.reply({
                    content:
                        "❌ Leaderboard está desactivado.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const data = readData();

            const users =
                data.users[
                    interaction.guild.id
                ] || {};

            const ranking =
                Object.entries(users)
                    .sort(
                        (a, b) =>
                            (b[1].balance || 0) -
                            (a[1].balance || 0)
                    )
                    .slice(0, 10);

            let text = "";

            for (
                let i = 0;
                i < ranking.length;
                i++
            ) {
                const [
                    userId,
                    userData
                ] = ranking[i];

                const member =
                    await interaction.guild.members
                        .fetch(userId)
                        .catch(() => null);

                text += `${i === 0 ? "🥇" :
                    i === 1 ? "🥈" :
                    i === 2 ? "🥉" :
                    `${i + 1}️⃣`
                    } ${member ? member.user.username : userId} — ${money(userData.balance)}\n`;
            }

            if (!text) {
                text =
                    "Todavía no hay usuarios registrados.";
            }

            const embed = new EmbedBuilder()
                .setColor(0x7c3aed)
                .setTitle(
                    "🏆 TOP ECONOMÍA"
                )
                .setDescription(text);

            return interaction.reply({
                embeds: [embed]
            });
        }

        // ----------------------------------------------------
        // /economy
        // ----------------------------------------------------

        if (
            interaction.commandName ===
            "economy"
        ) {

            const config = getGuildConfig(
                interaction.guild.id
            );

            const embed = new EmbedBuilder()
                .setColor(0x7c3aed)
                .setTitle(
                    "💰 SOCIAL WORLD ECONOMY"
                )
                .setDescription(
                    [
                        `${getEmoji(config)} **Moneda:** ${config.currencyName}`,
                        `💰 **Presupuesto:** $${money(config.budget)} USD`,
                        `⌨️ **Prefijo:** \`${config.prefix}\``,
                        "",
                        `🎁 **Daily:** ${money(config.daily.min)} - ${money(config.daily.max)}`,
                        `💼 **Work:** ${money(config.work.min)} - ${money(config.work.max)}`,
                        "",
                        `💸 Pay: ${config.systems.pay ? "🟢" : "🔴"}`,
                        `🏆 Leaderboard: ${config.systems.leaderboard ? "🟢" : "🔴"}`,
                        `👤 Profile: ${config.systems.profile ? "🟢" : "🔴"}`,
                        `📊 Stats: ${config.systems.stats ? "🟢" : "🔴"}`,
                        `🏦 Préstamos: ${config.systems.loans ? "🟢" : "🔴"}`
                    ].join("\n")
                );

            return interaction.reply({
                embeds: [embed]
            });
        }

        // ----------------------------------------------------
        // /guia
        // ----------------------------------------------------

        if (
            interaction.commandName ===
            "guia"
        ) {

            const config = getGuildConfig(
                interaction.guild.id
            );

            const embed = new EmbedBuilder()
                .setColor(0x7c3aed)
                .setTitle(
                    "📖 GUÍA OFICIAL • SW ECONOMY"
                )
                .setDescription(
                    [
                        "Bienvenido a **Social World Economy**.",
                        "",
                        "## 💰 COMANDOS",
                        "",
                        "💵 `/balance` — Consulta tu dinero.",
                        "👤 `/profile` — Consulta tu perfil.",
                        "🎁 `/daily` — Reclama tu recompensa.",
                        "💼 `/work` — Trabaja y gana dinero.",
                        "💸 `/pay` — Envía dinero.",
                        "🏆 `/leaderboard` — Consulta el ranking.",
                        "📊 `/economy` — Consulta la configuración.",
                        "",
                        `💵 Moneda: ${config.currencyEmoji} ${config.currencyName}`,
                        `⌨️ Prefijo configurado: \`${config.prefix}\``,
                        "",
                        "🏦 Si la tesorería se queda sin fondos, puede utilizarse el sistema de préstamos virtuales."
                    ].join("\n")
                )
                .setFooter({
                    text: "SW Economy • Guía Oficial"
                });

            try {
                await interaction.user.send({
                    embeds: [embed]
                });

                return interaction.reply({
                    content:
                        "📖 Te envié la guía completa por MD.",
                    flags: MessageFlags.Ephemeral
                });
            } catch {
                return interaction.reply({
                    content:
                        "❌ No pude enviarte la guía por MD. Revisa que tengas los mensajes directos habilitados.",
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ----------------------------------------------------
        // /eco ADMIN
        // ----------------------------------------------------

        if (
            interaction.commandName ===
            "eco"
        ) {

            const config = getGuildConfig(
                interaction.guild.id
            );

            if (
                !hasStaffPermission(
                    interaction.member,
                    config
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ No tienes permisos para administrar la economía.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const sub =
                interaction.options.getSubcommand();

            // ADD
            if (sub === "add") {

                const target =
                    interaction.options.getUser(
                        "usuario"
                    );

                const amount =
                    interaction.options.getNumber(
                        "cantidad"
                    );

                if (amount <= 0) {
                    return interaction.reply({
                        content:
                            "❌ La cantidad debe ser mayor que 0.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const user = getUser(
                    interaction.guild.id,
                    target.id
                );

                user.balance += amount;
                user.earned += amount;

                const data = readData();

                data.users[
                    interaction.guild.id
                ][target.id] = user;

                writeData(data);

                await sendLog(
                    interaction.guild,
                    "💰 Dinero añadido",
                    `🛡️ Staff: ${interaction.user}\n👤 Usuario: ${target}\n💰 Cantidad: ${money(amount)}`
                );

                return interaction.reply({
                    content:
                        `✅ Añadidos **${money(amount)} ${getCurrency(config)}** a ${target}.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // REMOVE
            if (sub === "remove") {

                const target =
                    interaction.options.getUser(
                        "usuario"
                    );

                const amount =
                    interaction.options.getNumber(
                        "cantidad"
                    );

                const user = getUser(
                    interaction.guild.id,
                    target.id
                );

                user.balance =
                    Math.max(
                        0,
                        user.balance - amount
                    );

                const data = readData();

                data.users[
                    interaction.guild.id
                ][target.id] = user;

                writeData(data);

                await sendLog(
                    interaction.guild,
                    "💸 Dinero retirado",
                    `🛡️ Staff: ${interaction.user}\n👤 Usuario: ${target}\n💰 Cantidad: ${money(amount)}`
                );

                return interaction.reply({
                    content:
                        `✅ Se retiraron **${money(amount)} ${getCurrency(config)}** de ${target}.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // SET
            if (sub === "set") {

                const target =
                    interaction.options.getUser(
                        "usuario"
                    );

                const amount =
                    interaction.options.getNumber(
                        "cantidad"
                    );

                const user = getUser(
                    interaction.guild.id,
                    target.id
                );

                user.balance =
                    Math.max(0, amount);

                const data = readData();

                data.users[
                    interaction.guild.id
                ][target.id] = user;

                writeData(data);

                await sendLog(
                    interaction.guild,
                    "🔄 Balance establecido",
                    `🛡️ Staff: ${interaction.user}\n👤 Usuario: ${target}\n💰 Nuevo balance: ${money(amount)}`
                );

                return interaction.reply({
                    content:
                        `✅ El balance de ${target} ahora es **${money(amount)} ${getCurrency(config)}**.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // RESET
            if (sub === "reset") {

                const target =
                    interaction.options.getUser(
                        "usuario"
                    );

                const data = readData();

                if (!data.users[interaction.guild.id]) {
                    data.users[interaction.guild.id] = {};
                }

                data.users[
                    interaction.guild.id
                ][target.id] = {
                    balance: config.initialBalance,
                    earned: 0,
                    spent: 0,
                    dailyUses: 0,
                    workUses: 0,
                    lastDaily: 0,
                    lastWork: 0
                };

                writeData(data);

                await sendLog(
                    interaction.guild,
                    "🔄 Usuario reiniciado",
                    `🛡️ Staff: ${interaction.user}\n👤 Usuario: ${target}`
                );

                return interaction.reply({
                    content:
                        `✅ Economía de ${target} reiniciada.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // GIVEALL
            if (sub === "giveall") {

                const amount =
                    interaction.options.getNumber(
                        "cantidad"
                    );

                if (amount <= 0) {
                    return interaction.reply({
                        content:
                            "❌ La cantidad debe ser mayor que 0.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const data = readData();

                if (
                    !data.users[
                        interaction.guild.id
                    ]
                ) {
                    data.users[
                        interaction.guild.id
                    ] = {};
                }

                let count = 0;

                for (
                    const userId of Object.keys(
                        data.users[
                            interaction.guild.id
                        ]
                    )
                ) {
                    data.users[
                        interaction.guild.id
                    ][userId].balance += amount;

                    data.users[
                        interaction.guild.id
                    ][userId].earned += amount;

                    count++;
                }

                writeData(data);

                await sendLog(
                    interaction.guild,
                    "🎁 GiveAll",
                    `🛡️ Staff: ${interaction.user}\n💰 Cantidad: ${money(amount)}\n👥 Usuarios: ${count}`
                );

                return interaction.reply({
                    content:
                        `🎁 Se añadieron **${money(amount)} ${getCurrency(config)}** a **${count} usuarios**.`,
                    flags: MessageFlags.Ephemeral
                });
            }

            // STATS
            if (sub === "stats") {

                const data = readData();

                const users =
                    data.users[
                        interaction.guild.id
                    ] || {};

                let circulation = 0;
                let earned = 0;
                let spent = 0;

                for (
                    const user of Object.values(
                        users
                    )
                ) {
                    circulation +=
                        user.balance || 0;

                    earned +=
                        user.earned || 0;

                    spent +=
                        user.spent || 0;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x7c3aed)
                    .setTitle(
                        "📊 ESTADÍSTICAS ECONÓMICAS"
                    )
                    .setDescription(
                        [
                            `👥 **Usuarios:** ${Object.keys(users).length}`,
                            "",
                            `💰 **En circulación:** ${money(circulation)}`,
                            `📈 **Generado:** ${money(earned)}`,
                            `📉 **Gastado:** ${money(spent)}`,
                            "",
                            `🏦 **Tesorería:** $${money(config.treasury.budget)} USD`
                        ].join("\n")
                    );

                return interaction.reply({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral
                });
            }
        }
    }

    // ========================================================
    // BOTONES
    // ========================================================

    if (interaction.isButton()) {

        const session = setupSessions.get(
            `${interaction.guild.id}:${interaction.user.id}`
        );

        if (
            !session ||
            session.channelId !== interaction.channel.id
        ) {
            return interaction.reply({
                content:
                    "❌ Esta configuración ya no está activa.",
                flags: MessageFlags.Ephemeral
            });
        }

        // ----------------------------------------------------
        // CANCELAR
        // ----------------------------------------------------

        if (
            interaction.customId ===
            "setup_cancel"
        ) {
            setupSessions.delete(
                `${session.guildId}:${session.userId}`
            );

            await interaction.reply({
                content:
                    "❌ Configuración cancelada. El canal será eliminado.",
                flags: MessageFlags.Ephemeral
            });

            setTimeout(async () => {
                await interaction.channel.delete()
                    .catch(() => {});
            }, 2500);

            return;
        }

        // ----------------------------------------------------
        // ATRÁS
        // ----------------------------------------------------

        if (
            interaction.customId ===
            "setup_back"
        ) {

            if (session.step > 1) {
                session.step--;
            }

            await interaction.update({
                embeds: [
                    setupEmbed(session)
                ],
                components:
                    setupComponents(session)
            });

            return;
        }

        // ----------------------------------------------------
        // SIGUIENTE
        // ----------------------------------------------------

        if (
            interaction.customId ===
            "setup_next"
        ) {

            if (session.step < 6) {
                session.step++;
            }

            await interaction.update({
                embeds: [
                    setupEmbed(session)
                ],
                components:
                    setupComponents(session)
            });

            return;
        }

        // ----------------------------------------------------
        // FINALIZAR
        // ----------------------------------------------------

        if (
            interaction.customId ===
            "setup_finish"
        ) {

            const data = readData();

            data.guilds[
                session.guildId
            ] = session.config;

            data.guilds[
                session.guildId
            ].setup.completed = true;

            writeData(data);

            await interaction.update({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x22c55e)
                        .setTitle(
                            "🎉 ECONOMÍA CONFIGURADA"
                        )
                        .setDescription(
                            [
                                "La configuración se guardó correctamente.",
                                "",
                                `💰 **Presupuesto:** $${money(session.config.budget)} USD`,
                                `💵 **Moneda:** ${session.config.currencyEmoji} ${session.config.currencyName}`,
                                `⌨️ **Prefijo:** \`${session.config.prefix}\``,
                                `🛡️ **Staff:** ${session.config.staffRole ? `<@&${session.config.staffRole}>` : "No configurado"}`,
                                `📋 **Logs:** ${session.config.channels.logs ? `<#${session.config.channels.logs}>` : "No configurado"}`,
                                "",
                                "🗑️ Este canal será eliminado automáticamente."
                            ].join("\n")
                        )
                ],
                components: []
            });

            await sendLog(
                interaction.guild,
                "⚙️ Economía configurada",
                [
                    `👤 Configurado por: ${interaction.user}`,
                    `💰 Presupuesto: $${money(session.config.budget)} USD`,
                    `💵 Moneda: ${session.config.currencyName}`,
                    `🛡️ Staff: ${session.config.staffRole ? `<@&${session.config.staffRole}>` : "No configurado"}`
                ].join("\n")
            );

            setupSessions.delete(
                `${session.guildId}:${session.userId}`
            );

            setTimeout(async () => {
                await interaction.channel.delete()
                    .catch(() => {});
            }, 5000);

            return;
        }

        // ----------------------------------------------------
        // MODALES
        // ----------------------------------------------------

        if (
            interaction.customId ===
            "setup_budget"
        ) {
            return interaction.showModal(
                createModal(
                    "modal_budget",
                    "💰 Presupuesto",
                    "Presupuesto inicial",
                    "Ejemplo: 10000000000",
                    session.config.budget
                )
            );
        }

        if (
            interaction.customId ===
            "setup_prefix"
        ) {
            return interaction.showModal(
                createModal(
                    "modal_prefix",
                    "⌨️ Prefijo",
                    "Prefijo de comandos",
                    "Ejemplo: !",
                    session.config.prefix
                )
            );
        }

        if (
            interaction.customId ===
            "setup_currency_name"
        ) {
            return interaction.showModal(
                createModal(
                    "modal_currency_name",
                    "💵 Moneda",
                    "Nombre de la moneda",
                    "Ejemplo: Social Cash",
                    session.config.currencyName
                )
            );
        }

        if (
            interaction.customId ===
            "setup_currency_emoji"
        ) {
            return interaction.showModal(
                createModal(
                    "modal_currency_emoji",
                    "🎨 Emoji",
                    "Emoji de la moneda",
                    "Ejemplo: 💰",
                    session.config.currencyEmoji
                )
            );
        }

        if (
            interaction.customId ===
            "setup_initial"
        ) {
            return interaction.showModal(
                createModal(
                    "modal_initial",
                    "💰 Balance inicial",
                    "Cantidad inicial",
                    "Ejemplo: 1000",
                    session.config.initialBalance
                )
            );
        }

        if (
            interaction.customId ===
            "setup_daily"
        ) {
            return interaction.showModal(
                createModal(
                    "modal_daily",
                    "🎁 Daily",
                    "Mínimo y máximo separados por coma",
                    "Ejemplo: 500,1500",
                    `${session.config.daily.min},${session.config.daily.max}`
                )
            );
        }

        if (
            interaction.customId ===
            "setup_work"
        ) {
            return interaction.showModal(
                createModal(
                    "modal_work",
                    "💼 Work",
                    "Mínimo y máximo separados por coma",
                    "Ejemplo: 100,500",
                    `${session.config.work.min},${session.config.work.max}`
                )
            );
        }

        // ----------------------------------------------------
        // TOGGLE ECONOMÍA
        // ----------------------------------------------------

        if (
            interaction.customId ===
            "setup_toggle"
        ) {
            session.config.enabled =
                !session.config.enabled;

            await interaction.update({
                embeds: [
                    setupEmbed(session)
                ],
                components:
                    setupComponents(session)
            });

            return;
        }

        // ----------------------------------------------------
        // SISTEMAS
        // ----------------------------------------------------

        const systems = [
            "pay",
            "leaderboard",
            "profile",
            "stats",
            "loans"
        ];

        for (const system of systems) {
            if (
                interaction.customId ===
                `system_${system}`
            ) {
                session.config.systems[
                    system
                ] =
                    !session.config.systems[
                        system
                    ];

                await interaction.update({
                    embeds: [
                        setupEmbed(session)
                    ],
                    components:
                        setupComponents(session)
                });

                return;
            }
        }
    }

    // ========================================================
    // SELECTORES DE CANAL
    // ========================================================

    if (
        interaction.isChannelSelectMenu()
    ) {

        const session = setupSessions.get(
            `${interaction.guild.id}:${interaction.user.id}`
        );

        if (!session) {
            return interaction.reply({
                content:
                    "❌ Esta configuración ya no está activa.",
                flags: MessageFlags.Ephemeral
            });
        }

        const channelId =
            interaction.values[0];

        if (
            interaction.customId ===
            "setup_channel_economy"
        ) {
            session.config.channels.economy =
                channelId;
        }

        if (
            interaction.customId ===
            "setup_channel_logs"
        ) {
            session.config.channels.logs =
                channelId;
        }

        if (
            interaction.customId ===
            "setup_channel_loans"
        ) {
            session.config.channels.loans =
                channelId;
        }

        if (
            interaction.customId ===
            "setup_logs_final"
        ) {
            session.config.channels.logs =
                channelId;
        }

        await interaction.update({
            embeds: [
                setupEmbed(session)
            ],
            components:
                setupComponents(session)
        });

        return;
    }

    // ========================================================
    // SELECTOR DE ROL
    // ========================================================

    if (
        interaction.isRoleSelectMenu()
    ) {

        const session = setupSessions.get(
            `${interaction.guild.id}:${interaction.user.id}`
        );

        if (!session) {
            return interaction.reply({
                content:
                    "❌ Esta configuración ya no está activa.",
                flags: MessageFlags.Ephemeral
            });
        }

        session.config.staffRole =
            interaction.values[0];

        await interaction.update({
            embeds: [
                setupEmbed(session)
            ],
            components:
                setupComponents(session)
        });

        return;
    }

    // ========================================================
    // MODALES
    // ========================================================

    if (
        interaction.isModalSubmit()
    ) {

        const session = setupSessions.get(
            `${interaction.guild.id}:${interaction.user.id}`
        );

        if (!session) {
            return interaction.reply({
                content:
                    "❌ Esta configuración ya no está activa.",
                flags: MessageFlags.Ephemeral
            });
        }

        const value =
            interaction.fields.getTextInputValue(
                "value"
            );

        if (
            interaction.customId ===
            "modal_budget"
        ) {
            const amount =
                Number(
                    value.replace(
                        /[^0-9]/g,
                        ""
                    )
                );

            if (
                !Number.isFinite(amount) ||
                amount < 0
            ) {
                return interaction.reply({
                    content:
                        "❌ Cantidad inválida.",
                    flags: MessageFlags.Ephemeral
                });
            }

            session.config.budget =
                amount;

            session.config.treasury.budget =
                amount;
        }

        if (
            interaction.customId ===
            "modal_prefix"
        ) {
            if (
                value.length > 5
            ) {
                return interaction.reply({
                    content:
                        "❌ El prefijo puede tener máximo 5 caracteres.",
                    flags: MessageFlags.Ephemeral
                });
            }

            session.config.prefix =
                value;
        }

        if (
            interaction.customId ===
            "modal_currency_name"
        ) {
            session.config.currencyName =
                value.slice(0, 30);
        }

        if (
            interaction.customId ===
            "modal_currency_emoji"
        ) {
            session.config.currencyEmoji =
                value.slice(0, 100);
        }

        if (
            interaction.customId ===
            "modal_initial"
        ) {
            const amount =
                Number(
                    value.replace(
                        /[^0-9]/g,
                        ""
                    )
                );

            if (
                !Number.isFinite(amount) ||
                amount < 0
            ) {
                return interaction.reply({
                    content:
                        "❌ Cantidad inválida.",
                    flags: MessageFlags.Ephemeral
                });
            }

            session.config.initialBalance =
                amount;
        }

        if (
            interaction.customId ===
            "modal_daily"
        ) {
            const parts =
                value.split(",")
                    .map(x =>
                        Number(
                            x.trim()
                        )
                    );

            if (
                parts.length !== 2 ||
                parts.some(
                    x =>
                        !Number.isFinite(x) ||
                        x < 0
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Usa el formato `500,1500`.",
                    flags: MessageFlags.Ephemeral
                });
            }

            session.config.daily.min =
                Math.min(
                    parts[0],
                    parts[1]
                );

            session.config.daily.max =
                Math.max(
                    parts[0],
                    parts[1]
                );
        }

        if (
            interaction.customId ===
            "modal_work"
        ) {
            const parts =
                value.split(",")
                    .map(x =>
                        Number(
                            x.trim()
                        )
                    );

            if (
                parts.length !== 2 ||
                parts.some(
                    x =>
                        !Number.isFinite(x) ||
                        x < 0
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Usa el formato `100,500`.",
                    flags: MessageFlags.Ephemeral
                });
            }

            session.config.work.min =
                Math.min(
                    parts[0],
                    parts[1]
                );

            session.config.work.max =
                Math.max(
                    parts[0],
                    parts[1]
                );
        }

        await interaction.reply({
            content:
                "✅ Configuración actualizada.",
            flags: MessageFlags.Ephemeral
        });

        await interaction.channel.send({
            embeds: [
                setupEmbed(session)
            ],
            components:
                setupComponents(session)
        });

        return;
    }
});

// ============================================================
// MENSAJES DE PREFIJO
// ============================================================

client.on("messageCreate", async message => {

    if (
        message.author.bot ||
        !message.guild
    ) {
        return;
    }

    const config =
        getGuildConfig(
            message.guild.id
        );

    const prefix =
        config.prefix || "!";

    if (
        !message.content.startsWith(prefix)
    ) {
        return;
    }

    const args =
        message.content
            .slice(prefix.length)
            .trim()
            .split(/\s+/);

    const command =
        (args.shift() || "")
            .toLowerCase();

    if (command === "balance") {

        const user =
            getUser(
                message.guild.id,
                message.author.id
            );

        return message.reply(
            `${getEmoji(config)} **Balance:** ${money(user.balance)} ${getCurrency(config)}`
        );
    }

    if (command === "daily") {

        if (!config.daily.enabled) {
            return message.reply(
                "❌ Daily está desactivado."
            );
        }

        const user =
            getUser(
                message.guild.id,
                message.author.id
            );

        const now =
            Date.now();

        if (
            now - user.lastDaily <
            config.daily.cooldown
        ) {
            return message.reply(
                "⏰ Todavía no puedes reclamar tu Daily."
            );
        }

        const reward =
            randomNumber(
                config.daily.min,
                config.daily.max
            );

        if (
            config.treasury.budget <
            reward
        ) {
            return message.reply(
                "🚨 La tesorería no tiene fondos suficientes."
            );
        }

        user.balance += reward;
        user.earned += reward;
        user.dailyUses++;
        user.lastDaily = now;

        config.treasury.budget -=
            reward;

        const data =
            readData();

        data.users[
            message.guild.id
        ][message.author.id] =
            user;

        data.guilds[
            message.guild.id
        ] = config;

        writeData(data);

        return message.reply(
            `🎁 Recibiste **${money(reward)} ${getCurrency(config)}**.`
        );
    }

    if (command === "work") {

        if (!config.work.enabled) {
            return message.reply(
                "❌ Work está desactivado."
            );
        }

        const user =
            getUser(
                message.guild.id,
                message.author.id
            );

        const now =
            Date.now();

        if (
            now - user.lastWork <
            config.work.cooldown
        ) {
            return message.reply(
                "⏰ Todavía no puedes trabajar."
            );
        }

        const reward =
            randomNumber(
                config.work.min,
                config.work.max
            );

        if (
            config.treasury.budget <
            reward
        ) {
            return message.reply(
                "🚨 La tesorería no tiene fondos suficientes."
            );
        }

        user.balance += reward;
        user.earned += reward;
        user.workUses++;
        user.lastWork = now;

        config.treasury.budget -=
            reward;

        const data =
            readData();

        data.users[
            message.guild.id
        ][message.author.id] =
            user;

        data.guilds[
            message.guild.id
        ] = config;

        writeData(data);

        return message.reply(
            `💼 Ganaste **${money(reward)} ${getCurrency(config)}**.`
        );
    }

    if (command === "help") {

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x7c3aed)
                    .setTitle(
                        "💰 SW ECONOMY"
                    )
                    .setDescription(
                        [
                            "### 💵 Economía",
                            `\`${prefix}balance\``,
                            `\`${prefix}daily\``,
                            `\`${prefix}work\``,
                            "",
                            "### ⚙️ Slash Commands",
                            "`/balance`",
                            "`/profile`",
                            "`/daily`",
                            "`/work`",
                            "`/pay`",
                            "`/leaderboard`",
                            "`/economy`",
                            "`/guia`",
                            "`/setup eco`"
                        ].join("\n")
                    )
            ]
        });
    }
});

// ============================================================
// LOGIN
// ============================================================

client.login(TOKEN)
    .then(() => {
        console.log(
            "🔐 Conectando a Discord..."
        );
    })
    .catch(error => {
        console.error(
            "❌ Error iniciando sesión:",
            error
        );
    });

// ============================================================
// MANEJO DE ERRORES
// ============================================================

process.on(
    "unhandledRejection",
    error => {
        console.error(
            "❌ Unhandled Rejection:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    error => {
        console.error(
            "❌ Uncaught Exception:",
            error
        );
    }
);
