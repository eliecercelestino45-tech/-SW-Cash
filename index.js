require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    SlashCommandBuilder,
    REST,
    Routes
} = require("discord.js");

const express = require("express");
const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const PORT = process.env.PORT || 3000;

// ============================================================
// PORT - SOLO PARA HOSTING
// ============================================================

const app = express();

app.get("/", (req, res) => {
    res.send("🟣 Social World Economy • Bot Online");
});

app.get("/health", (req, res) => {
    res.json({
        online: true,
        bot: client.user ? client.user.tag : null,
        guilds: client.guilds?.cache.size || 0,
        uptime: process.uptime()
    });
});

app.listen(PORT, () => {
    console.log(`🌐 PORT ${PORT} iniciado correctamente.`);
});

// ============================================================
// ARCHIVOS JSON
// ============================================================

const DATA_DIR = path.join(__dirname, "data");
const ECONOMY_FILE = path.join(DATA_DIR, "economy.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let database = {
    guilds: {}
};

function loadDatabase() {
    try {
        if (!fs.existsSync(ECONOMY_FILE)) {
            saveDatabase();
            return;
        }

        const data = fs.readFileSync(
            ECONOMY_FILE,
            "utf8"
        );

        if (!data.trim()) {
            database = { guilds: {} };
            saveDatabase();
            return;
        }

        database = JSON.parse(data);

        if (!database.guilds) {
            database.guilds = {};
        }

    } catch (error) {
        console.error("❌ Error cargando economy.json:", error);
        database = { guilds: {} };
    }
}

function saveDatabase() {
    try {
        fs.writeFileSync(
            ECONOMY_FILE,
            JSON.stringify(database, null, 2)
        );
    } catch (error) {
        console.error("❌ Error guardando economy.json:", error);
    }
}

loadDatabase();

// ============================================================
// CONFIGURACIÓN POR SERVIDOR
// ============================================================

function defaultGuild() {
    return {
        enabled: false,

        staffRole: null,

        economyChannel: null,

        currency: {
            name: "Social Coins",
            symbol: "<:emoji_14:1380789782635872329>"
        },

        settings: {
            startingBalance: 1000,

            dailyMin: 500,
            dailyMax: 1500,

            workMin: 100,
            workMax: 500,

            dailyCooldown: 24 * 60 * 60 * 1000,
            workCooldown: 60 * 60 * 1000,

            payEnabled: true,
            leaderboardEnabled: true
        },

        users: {}
    };
}

function getGuild(guildId) {

    if (!database.guilds[guildId]) {
        database.guilds[guildId] = defaultGuild();
        saveDatabase();
    }

    const guild = database.guilds[guildId];

    if (!guild.currency) {
        guild.currency = defaultGuild().currency;
    }

    if (!guild.settings) {
        guild.settings = defaultGuild().settings;
    }

    if (!guild.users) {
        guild.users = {};
    }

    if (!Object.prototype.hasOwnProperty.call(guild, "staffRole")) {
        guild.staffRole = null;
    }

    if (!Object.prototype.hasOwnProperty.call(guild, "enabled")) {
        guild.enabled = false;
    }

    return guild;
}

// ============================================================
// DATOS DE USUARIO
// ============================================================

function getUser(guildId, userId) {

    const guild = getGuild(guildId);

    if (!guild.users[userId]) {

        guild.users[userId] = {
            balance: guild.settings.startingBalance,

            totalEarned: 0,
            totalSpent: 0,

            dailyUses: 0,
            workUses: 0,

            lastDaily: 0,
            lastWork: 0,

            createdAt: Date.now()
        };

        saveDatabase();
    }

    return guild.users[userId];
}

// ============================================================
// UTILIDADES
// ============================================================

function money(amount) {
    return Number(amount || 0).toLocaleString("es-CO");
}

function random(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}

function cooldown(last, time) {
    if (!last) return 0;

    return Math.max(
        0,
        time - (Date.now() - last)
    );
}

function duration(ms) {

    let seconds = Math.ceil(ms / 1000);

    if (seconds < 60) {
        return `${seconds} segundos`;
    }

    let minutes = Math.ceil(seconds / 60);

    if (minutes < 60) {
        return `${minutes} minutos`;
    }

    let hours = Math.ceil(minutes / 60);

    if (hours < 24) {
        return `${hours} horas`;
    }

    let days = Math.ceil(hours / 24);

    return `${days} días`;
}

function getRank(guildId, userId) {

    const guild = getGuild(guildId);

    const users = Object.entries(guild.users)
        .sort(
            (a, b) =>
                Number(b[1].balance || 0) -
                Number(a[1].balance || 0)
        );

    const position = users.findIndex(
        ([id]) => id === userId
    );

    if (position === -1) return null;

    return position + 1;
}

// ============================================================
// STAFF ECONOMY
// ============================================================

function isEconomyStaff(interaction) {

    if (
        interaction.memberPermissions?.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return true;
    }

    const guild = getGuild(
        interaction.guild.id
    );

    if (!guild.staffRole) {
        return false;
    }

    return interaction.member.roles.cache.has(
        guild.staffRole
    );
}

// ============================================================
// CLIENT
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// ============================================================
// COMANDOS
// ============================================================

const commands = [

    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configura los sistemas del servidor")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )
        .addSubcommand(sub =>
            sub
                .setName("eco")
                .setDescription("Configura la economía")
        ),

    new SlashCommandBuilder()
        .setName("balance")
        .setDescription("Consulta tu balance")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("profile")
        .setDescription("Consulta un perfil económico")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(false)
        ),

    new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Reclama tu recompensa diaria"),

    new SlashCommandBuilder()
        .setName("work")
        .setDescription("Trabaja para ganar dinero"),

    new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Envía dinero a otro usuario")
        .addUserOption(option =>
            option
                .setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("cantidad")
                .setDescription("Cantidad")
                .setMinValue(1)
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Muestra el ranking económico"),

    new SlashCommandBuilder()
        .setName("economy")
        .setDescription("Información de la economía"),

    new SlashCommandBuilder()
        .setName("eco")
        .setDescription("Administración de economía")

        .addSubcommand(sub =>
            sub
                .setName("add")
                .setDescription("Añade dinero")
                .addUserOption(option =>
                    option
                        .setName("usuario")
                        .setDescription("Usuario")
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName("cantidad")
                        .setDescription("Cantidad")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("remove")
                .setDescription("Quita dinero")
                .addUserOption(option =>
                    option
                        .setName("usuario")
                        .setDescription("Usuario")
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName("cantidad")
                        .setDescription("Cantidad")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("set")
                .setDescription("Establece un balance")
                .addUserOption(option =>
                    option
                        .setName("usuario")
                        .setDescription("Usuario")
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName("cantidad")
                        .setDescription("Cantidad")
                        .setMinValue(0)
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("reset")
                .setDescription("Reinicia un usuario")
                .addUserOption(option =>
                    option
                        .setName("usuario")
                        .setDescription("Usuario")
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("giveall")
                .setDescription("Da dinero a todos")
                .addIntegerOption(option =>
                    option
                        .setName("cantidad")
                        .setDescription("Cantidad")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("stats")
                .setDescription("Estadísticas económicas")
        )

].map(command => command.toJSON());

// ============================================================
// REGISTRAR COMANDOS GLOBALES
// ============================================================

async function registerCommands() {

    if (!TOKEN || !CLIENT_ID) {
        console.error(
            "❌ TOKEN o CLIENT_ID no configurados."
        );
        return;
    }

    try {

        const rest = new REST({
            version: "10"
        }).setToken(TOKEN);

        console.log(
            "🌎 Registrando comandos globales..."
        );

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

client.once("ready", async () => {

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

    await registerCommands();

    client.user.setPresence({
        status: "online",
        activities: [
            {
                name: "Social World | /economy",
                type: 3
            }
        ]
    });
});

// ============================================================
// INTERACCIONES
// ============================================================

client.on(
    "interactionCreate",
    async interaction => {

        try {

            // ==================================================
            // BOTONES
            // ==================================================

            if (interaction.isButton()) {

                if (
                    interaction.customId ===
                    "eco_main"
                ) {

                    if (
                        !interaction.memberPermissions.has(
                            PermissionFlagsBits.Administrator
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Necesitas Administrador.",
                            ephemeral: true
                        });
                    }

                    return economySetup(
                        interaction,
                        true
                    );
                }

                // ==============================================
                // STAFF ROLE
                // ==============================================

                if (
                    interaction.customId ===
                    "eco_staff"
                ) {

                    if (
                        !interaction.memberPermissions.has(
                            PermissionFlagsBits.Administrator
                        )
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Necesitas Administrador.",
                            ephemeral: true
                        });
                    }

                    const roles =
                        interaction.guild.roles.cache
                            .filter(
                                role =>
                                    role.id !==
                                    interaction.guild.id
                            )
                            .sort(
                                (a, b) =>
                                    b.position -
                                    a.position
                            )
                            .first(25);

                    if (!roles.length) {
                        return interaction.reply({
                            content:
                                "❌ No hay roles disponibles.",
                            ephemeral: true
                        });
                    }

                    const menu =
                        new StringSelectMenuBuilder()
                            .setCustomId(
                                "eco_staff_select"
                            )
                            .setPlaceholder(
                                "Selecciona Staff Economy"
                            )
                            .addOptions(
                                roles.map(role => ({
                                    label:
                                        role.name.slice(
                                            0,
                                            100
                                        ),
                                    value:
                                        role.id,
                                    description:
                                        "Rol administrador de economía"
                                }))
                            );

                    return interaction.reply({
                        content:
                            "🛡️ Selecciona el rol que podrá usar los comandos administrativos de economía.",
                        components: [
                            new ActionRowBuilder()
                                .addComponents(menu)
                        ],
                        ephemeral: true
                    });
                }

                // ==============================================
                // MONEDA
                // ==============================================

                if (
                    interaction.customId ===
                    "eco_currency"
                ) {

                    const guild =
                        getGuild(
                            interaction.guild.id
                        );

                    const modal =
                        new ModalBuilder()
                            .setCustomId(
                                "currency_modal"
                            )
                            .setTitle(
                                "💰 Configurar moneda"
                            );

                    const name =
                        new TextInputBuilder()
                            .setCustomId(
                                "currency_name"
                            )
                            .setLabel(
                                "Nombre"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true)
                            .setMaxLength(30)
                            .setValue(
                                guild.currency.name
                            );

                    const symbol =
                        new TextInputBuilder()
                            .setCustomId(
                                "currency_symbol"
                            )
                            .setLabel(
                                "Emoji / símbolo"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true)
                            .setMaxLength(100)
                            .setValue(
                                guild.currency.symbol
                            );

                    modal.addComponents(
                        new ActionRowBuilder()
                            .addComponents(name),
                        new ActionRowBuilder()
                            .addComponents(symbol)
                    );

                    return interaction.showModal(
                        modal
                    );
                }

                // ==============================================
                // RECOMPENSAS
                // ==============================================

                if (
                    interaction.customId ===
                    "eco_rewards"
                ) {

                    const guild =
                        getGuild(
                            interaction.guild.id
                        );

                    const modal =
                        new ModalBuilder()
                            .setCustomId(
                                "rewards_modal"
                            )
                            .setTitle(
                                "🎁 Recompensas"
                            );

                    const daily =
                        new TextInputBuilder()
                            .setCustomId(
                                "daily"
                            )
                            .setLabel(
                                "Daily mínimo-máximo"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true)
                            .setValue(
                                `${guild.settings.dailyMin}-${guild.settings.dailyMax}`
                            );

                    const work =
                        new TextInputBuilder()
                            .setCustomId(
                                "work"
                            )
                            .setLabel(
                                "Work mínimo-máximo"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true)
                            .setValue(
                                `${guild.settings.workMin}-${guild.settings.workMax}`
                            );

                    const initial =
                        new TextInputBuilder()
                            .setCustomId(
                                "initial"
                            )
                            .setLabel(
                                "Balance inicial"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true)
                            .setValue(
                                String(
                                    guild.settings.startingBalance
                                )
                            );

                    modal.addComponents(
                        new ActionRowBuilder()
                            .addComponents(daily),
                        new ActionRowBuilder()
                            .addComponents(work),
                        new ActionRowBuilder()
                            .addComponents(initial)
                    );

                    return interaction.showModal(
                        modal
                    );
                }

                // ==============================================
                // COOLDOWNS
                // ==============================================

                if (
                    interaction.customId ===
                    "eco_cooldowns"
                ) {

                    const guild =
                        getGuild(
                            interaction.guild.id
                        );

                    const modal =
                        new ModalBuilder()
                            .setCustomId(
                                "cooldowns_modal"
                            )
                            .setTitle(
                                "⏰ Cooldowns"
                            );

                    const daily =
                        new TextInputBuilder()
                            .setCustomId(
                                "daily_hours"
                            )
                            .setLabel(
                                "Daily en horas"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true)
                            .setValue(
                                String(
                                    guild.settings.dailyCooldown /
                                    3600000
                                )
                            );

                    const work =
                        new TextInputBuilder()
                            .setCustomId(
                                "work_hours"
                            )
                            .setLabel(
                                "Work en horas"
                            )
                            .setStyle(
                                TextInputStyle.Short
                            )
                            .setRequired(true)
                            .setValue(
                                String(
                                    guild.settings.workCooldown /
                                    3600000
                                )
                            );

                    modal.addComponents(
                        new ActionRowBuilder()
                            .addComponents(daily),
                        new ActionRowBuilder()
                            .addComponents(work)
                    );

                    return interaction.showModal(
                        modal
                    );
                }

                // ==============================================
                // PAY
                // ==============================================

                if (
                    interaction.customId ===
                    "eco_pay"
                ) {

                    const guild =
                        getGuild(
                            interaction.guild.id
                        );

                    guild.settings.payEnabled =
                        !guild.settings.payEnabled;

                    saveDatabase();

                    return interaction.reply({
                        content:
                            `💸 `/pay` ahora está **${guild.settings.payEnabled ? "ACTIVADO 🟢" : "DESACTIVADO 🔴"}**.`,
                        ephemeral: true
                    });
                }

                // ==============================================
                // LEADERBOARD
                // ==============================================

                if (
                    interaction.customId ===
                    "eco_leaderboard"
                ) {

                    const guild =
                        getGuild(
                            interaction.guild.id
                        );

                    guild.settings.leaderboardEnabled =
                        !guild.settings.leaderboardEnabled;

                    saveDatabase();

                    return interaction.reply({
                        content:
                            `🏆 Leaderboard ahora está **${guild.settings.leaderboardEnabled ? "ACTIVADO 🟢" : "DESACTIVADO 🔴"}**.`,
                        ephemeral: true
                    });
                }

                // ==============================================
                // ACTIVAR
                // ==============================================

                if (
                    interaction.customId ===
                    "eco_enable"
                ) {

                    const guild =
                        getGuild(
                            interaction.guild.id
                        );

                    guild.enabled = true;

                    saveDatabase();

                    return interaction.reply({
                        content:
                            "🟢 **Economía activada correctamente.**",
                        ephemeral: true
                    });
                }

                // ==============================================
                // DESACTIVAR
                // ==============================================

                if (
                    interaction.customId ===
                    "eco_disable"
                ) {

                    const guild =
                        getGuild(
                            interaction.guild.id
                        );

                    guild.enabled = false;

                    saveDatabase();

                    return interaction.reply({
                        content:
                            "🔴 **Economía desactivada.**",
                        ephemeral: true
                    });
                }
            }

            // ==================================================
            // SELECT MENU
            // ==================================================

            if (interaction.isStringSelectMenu()) {

                if (
                    interaction.customId ===
                    "eco_staff_select"
                ) {

                    const roleId =
                        interaction.values[0];

                    const guild =
                        getGuild(
                            interaction.guild.id
                        );

                    guild.staffRole =
                        roleId;

                    saveDatabase();

                    return interaction.update({
                        content:
                            `✅ Staff Economy configurado como <@&${roleId}>.`,
                        components: []
                    });
                }
            }

            // ==================================================
            // MODALES
            // ==================================================

            if (interaction.isModalSubmit()) {

                // ==============================================
                // MONEDA
                // ==============================================

                if (
                    interaction.customId ===
                    "currency_modal"
                ) {

                    const guild =
                        getGuild(
                            interaction.guild.id
                        );

                    guild.currency.name =
                        interaction.fields.getTextInputValue(
                            "currency_name"
                        );

                    guild.currency.symbol =
                        interaction.fields.getTextInputValue(
                            "currency_symbol"
                        );

                    saveDatabase();

                    return interaction.reply({
                        content:
                            `✅ Moneda configurada como **${guild.currency.symbol} ${guild.currency.name}**.`,
                        ephemeral: true
                    });
                }

                // ==============================================
                // RECOMPENSAS
                // ==============================================

                if (
                    interaction.customId ===
                    "rewards_modal"
                ) {

                    const guild =
                        getGuild(
                            interaction.guild.id
                        );

                    const daily =
                        interaction.fields.getTextInputValue(
                            "daily"
                        );

                    const work =
                        interaction.fields.getTextInputValue(
                            "work"
                        );

                    const initial =
                        Number(
                            interaction.fields.getTextInputValue(
                                "initial"
                            )
                        );

                    const dailyParts =
                        daily.split("-");

                    const workParts =
                        work.split("-");

                    const dailyMin =
                        Number(
                            dailyParts[0]
                        );

                    const dailyMax =
                        Number(
                            dailyParts[1]
                        );

                    const workMin =
                        Number(
                            workParts[0]
                        );

                    const workMax =
                        Number(
                            workParts[1]
                        );

                    if (
                        !Number.isFinite(
                            dailyMin
                        ) ||
                        !Number.isFinite(
                            dailyMax
                        ) ||
                        dailyMin < 0 ||
                        dailyMax < dailyMin
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Daily inválido. Ejemplo: `500-1500`",
                            ephemeral: true
                        });
                    }

                    if (
                        !Number.isFinite(
                            workMin
                        ) ||
                        !Number.isFinite(
                            workMax
                        ) ||
                        workMin < 0 ||
                        workMax < workMin
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Work inválido. Ejemplo: `100-500`",
                            ephemeral: true
                        });
                    }

                    if (
                        !Number.isFinite(
                            initial
                        ) ||
                        initial < 0
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Balance inicial inválido.",
                            ephemeral: true
                        });
                    }

                    guild.settings.dailyMin =
                        dailyMin;

                    guild.settings.dailyMax =
                        dailyMax;

                    guild.settings.workMin =
                        workMin;

                    guild.settings.workMax =
                        workMax;

                    guild.settings.startingBalance =
                        initial;

                    saveDatabase();

                    return interaction.reply({
                        content:
                            "✅ Recompensas actualizadas correctamente.",
                        ephemeral: true
                    });
                }

                // ==============================================
                // COOLDOWNS
                // ==============================================

                if (
                    interaction.customId ===
                    "cooldowns_modal"
                ) {

                    const guild =
                        getGuild(
                            interaction.guild.id
                        );

                    const daily =
                        Number(
                            interaction.fields.getTextInputValue(
                                "daily_hours"
                            )
                        );

                    const work =
                        Number(
                            interaction.fields.getTextInputValue(
                                "work_hours"
                            )
                        );

                    if (
                        !Number.isFinite(daily) ||
                        daily <= 0 ||
                        !Number.isFinite(work) ||
                        work <= 0
                    ) {
                        return interaction.reply({
                            content:
                                "❌ Los cooldowns deben ser mayores que 0.",
                            ephemeral: true
                        });
                    }

                    guild.settings.dailyCooldown =
                        daily *
                        60 *
                        60 *
                        1000;

                    guild.settings.workCooldown =
                        work *
                        60 *
                        60 *
                        1000;

                    saveDatabase();

                    return interaction.reply({
                        content:
                            "✅ Cooldowns actualizados.",
                        ephemeral: true
                    });
                }
            }

            // ==================================================
            // SLASH
            // ==================================================

            if (!interaction.isChatInputCommand()) {
                return;
            }

            if (!interaction.guild) {
                return interaction.reply({
                    content:
                        "❌ Este comando solo funciona en servidores.",
                    ephemeral: true
                });
            }

            const guildId =
                interaction.guild.id;

            const guild =
                getGuild(guildId);

            const command =
                interaction.commandName;

            // ==================================================
            // SETUP
            // ==================================================

            if (
                command === "setup" &&
                interaction.options.getSubcommand() === "eco"
            ) {

                if (
                    !interaction.memberPermissions.has(
                        PermissionFlagsBits.Administrator
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Necesitas Administrador.",
                        ephemeral: true
                    });
                }

                return economySetup(
                    interaction,
                    false
                );
            }

            // ==================================================
            // ECONOMÍA DESACTIVADA
            // ==================================================

            if (!guild.enabled) {
                return interaction.reply({
                    content:
                        "❌ La economía está desactivada.\n\nUn administrador debe utilizar `/setup eco`.",
                    ephemeral: true
                });
            }

            // ==================================================
            // BALANCE
            // ==================================================

            if (
                command === "balance"
            ) {

                const target =
                    interaction.options.getUser(
                        "usuario"
                    ) || interaction.user;

                const user =
                    getUser(
                        guildId,
                        target.id
                    );

                const rank =
                    getRank(
                        guildId,
                        target.id
                    );

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            `💰 Balance de ${target.username}`
                        )
                        .setThumbnail(
                            target.displayAvatarURL({
                                size: 256
                            })
                        )
                        .setDescription(
                            [
                                `${guild.currency.symbol} **Balance:** ${money(user.balance)}`,
                                `${guild.currency.symbol} **Ganado:** ${money(user.totalEarned)}`,
                                `${guild.currency.symbol} **Gastado:** ${money(user.totalSpent)}`,
                                "",
                                `🏆 **Posición:** #${rank || "N/A"}`
                            ].join("\n")
                        )
                        .setTimestamp();

                return interaction.reply({
                    embeds: [embed]
                });
            }

            // ==================================================
            // PROFILE
            // ==================================================

            if (
                command === "profile"
            ) {

                const target =
                    interaction.options.getUser(
                        "usuario"
                    ) || interaction.user;

                const user =
                    getUser(
                        guildId,
                        target.id
                    );

                const rank =
                    getRank(
                        guildId,
                        target.id
                    );

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            "👤 PERFIL ECONÓMICO"
                        )
                        .setThumbnail(
                            target.displayAvatarURL({
                                size: 256
                            })
                        )
                        .addFields(
                            {
                                name: "💰 Balance",
                                value:
                                    `${guild.currency.symbol} ${money(user.balance)}`,
                                inline: true
                            },
                            {
                                name: "🏆 Ranking",
                                value:
                                    `#${rank || "N/A"}`,
                                inline: true
                            },
                            {
                                name: "📈 Ganado",
                                value:
                                    `${guild.currency.symbol} ${money(user.totalEarned)}`,
                                inline: true
                            },
                            {
                                name: "📉 Gastado",
                                value:
                                    `${guild.currency.symbol} ${money(user.totalSpent)}`,
                                inline: true
                            },
                            {
                                name: "🎁 Daily",
                                value:
                                    `${user.dailyUses} usos`,
                                inline: true
                            },
                            {
                                name: "💼 Work",
                                value:
                                    `${user.workUses} usos`,
                                inline: true
                            }
                        )
                        .setTimestamp();

                return interaction.reply({
                    embeds: [embed]
                });
            }

            // ==================================================
            // DAILY
            // ==================================================

            if (
                command === "daily"
            ) {

                const user =
                    getUser(
                        guildId,
                        interaction.user.id
                    );

                const remaining =
                    cooldown(
                        user.lastDaily,
                        guild.settings.dailyCooldown
                    );

                if (remaining > 0) {

                    return interaction.reply({
                        content:
                            `⏰ Ya reclamaste tu Daily.\n\nDisponible nuevamente en **${duration(remaining)}**.`,
                        ephemeral: true
                    });
                }

                const amount =
                    random(
                        guild.settings.dailyMin,
                        guild.settings.dailyMax
                    );

                user.balance +=
                    amount;

                user.totalEarned +=
                    amount;

                user.dailyUses++;

                user.lastDaily =
                    Date.now();

                saveDatabase();

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "🎁 DAILY RECLAMADO"
                            )
                            .setDescription(
                                [
                                    `Has recibido **${guild.currency.symbol} ${money(amount)}**.`,
                                    "",
                                    `💰 Balance: **${guild.currency.symbol} ${money(user.balance)}**`
                                ].join("\n")
                            )
                            .setTimestamp()
                    ]
                });
            }

            // ==================================================
            // WORK
            // ==================================================

            if (
                command === "work"
            ) {

                const user =
                    getUser(
                        guildId,
                        interaction.user.id
                    );

                const remaining =
                    cooldown(
                        user.lastWork,
                        guild.settings.workCooldown
                    );

                if (remaining > 0) {

                    return interaction.reply({
                        content:
                            `⏰ Ya trabajaste.\n\nPuedes volver a trabajar en **${duration(remaining)}**.`,
                        ephemeral: true
                    });
                }

                const amount =
                    random(
                        guild.settings.workMin,
                        guild.settings.workMax
                    );

                user.balance +=
                    amount;

                user.totalEarned +=
                    amount;

                user.workUses++;

                user.lastWork =
                    Date.now();

                saveDatabase();

                const jobs = [
                    "completaste un trabajo",
                    "hiciste un diseño",
                    "ayudaste a la comunidad",
                    "realizaste un encargo",
                    "trabajaste como diseñador",
                    "ayudaste a un miembro",
                    "terminaste una tarea"
                ];

                const job =
                    jobs[
                        Math.floor(
                            Math.random() *
                            jobs.length
                        )
                    ];

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "💼 TRABAJO COMPLETADO"
                            )
                            .setDescription(
                                [
                                    `${interaction.user} ${job}.`,
                                    "",
                                    `💰 Ganaste: **${guild.currency.symbol} ${money(amount)}**`,
                                    `💳 Balance: **${guild.currency.symbol} ${money(user.balance)}**`
                                ].join("\n")
                            )
                            .setTimestamp()
                    ]
                });
            }

            // ==================================================
            // PAY
            // ==================================================

            if (
                command === "pay"
            ) {

                if (
                    !guild.settings.payEnabled
                ) {
                    return interaction.reply({
                        content:
                            "❌ `/pay` está desactivado.",
                        ephemeral: true
                    });
                }

                const target =
                    interaction.options.getUser(
                        "usuario"
                    );

                const amount =
                    interaction.options.getInteger(
                        "cantidad"
                    );

                if (
                    target.id ===
                    interaction.user.id
                ) {
                    return interaction.reply({
                        content:
                            "❌ No puedes pagarte a ti mismo.",
                        ephemeral: true
                    });
                }

                if (target.bot) {
                    return interaction.reply({
                        content:
                            "❌ No puedes pagar a un bot.",
                        ephemeral: true
                    });
                }

                const sender =
                    getUser(
                        guildId,
                        interaction.user.id
                    );

                const receiver =
                    getUser(
                        guildId,
                        target.id
                    );

                if (
                    sender.balance <
                    amount
                ) {
                    return interaction.reply({
                        content:
                            `❌ No tienes suficiente dinero.\n\nTienes **${guild.currency.symbol} ${money(sender.balance)}**.`,
                        ephemeral: true
                    });
                }

                sender.balance -=
                    amount;

                sender.totalSpent +=
                    amount;

                receiver.balance +=
                    amount;

                receiver.totalEarned +=
                    amount;

                saveDatabase();

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "💸 TRANSFERENCIA"
                            )
                            .setDescription(
                                [
                                    `👤 **De:** ${interaction.user}`,
                                    `👤 **Para:** ${target}`,
                                    "",
                                    `💰 **Cantidad:** ${guild.currency.symbol} ${money(amount)}`,
                                    "",
                                    `💳 Tu balance: **${guild.currency.symbol} ${money(sender.balance)}**`
                                ].join("\n")
                            )
                            .setTimestamp()
                    ]
                });
            }

            // ==================================================
            // LEADERBOARD
            // ==================================================

            if (
                command === "leaderboard"
            ) {

                if (
                    !guild.settings.leaderboardEnabled
                ) {
                    return interaction.reply({
                        content:
                            "❌ El leaderboard está desactivado.",
                        ephemeral: true
                    });
                }

                const users =
                    Object.entries(
                        guild.users
                    )
                        .sort(
                            (a, b) =>
                                Number(b[1].balance || 0) -
                                Number(a[1].balance || 0)
                        )
                        .slice(0, 10);

                if (!users.length) {
                    return interaction.reply({
                        content:
                            "📊 Todavía no hay usuarios."
                    });
                }

                let text = "";

                for (
                    let i = 0;
                    i < users.length;
                    i++
                ) {

                    const [
                        userId,
                        data
                    ] = users[i];

                    let username =
                        userId;

                    try {
                        const member =
                            await interaction.guild.members.fetch(
                                userId
                            );

                        username =
                            member.user.username;

                    } catch {}

                    const medal =
                        [
                            "🥇",
                            "🥈",
                            "🥉"
                        ][i] ||
                        `**${i + 1}.**`;

                    text +=
                        `${medal} ${username} — **${guild.currency.symbol} ${money(data.balance)}**\n`;
                }

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "🏆 TOP ECONOMÍA"
                            )
                            .setDescription(
                                text
                            )
                            .setTimestamp()
                    ]
                });
            }

            // ==================================================
            // ECONOMY INFO
            // ==================================================

            if (
                command === "economy"
            ) {

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(
                                "💰 SOCIAL WORLD ECONOMY"
                            )
                            .setDescription(
                                [
                                    `💵 **Moneda:** ${guild.currency.symbol} ${guild.currency.name}`,
                                    `💰 **Balance inicial:** ${money(guild.settings.startingBalance)}`,
                                    "",
                                    `🎁 **Daily:** ${money(guild.settings.dailyMin)} - ${money(guild.settings.dailyMax)}`,
                                    `💼 **Work:** ${money(guild.settings.workMin)} - ${money(guild.settings.workMax)}`,
                                    "",
                                    "**📜 COMANDOS**",
                                    "`/balance` • Balance",
                                    "`/profile` • Perfil",
                                    "`/daily` • Recompensa diaria",
                                    "`/work` • Trabajar",
                                    "`/pay` • Transferir",
                                    "`/leaderboard` • Ranking",
                                    "`/economy` • Información"
                                ].join("\n")
                            )
                            .setTimestamp()
                    ]
                });
            }

            // ==================================================
            // ECO ADMIN
            // ==================================================

            if (
                command === "eco"
            ) {

                if (
                    !isEconomyStaff(
                        interaction
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ No tienes el rol Staff Economy configurado para este servidor.",
                        ephemeral: true
                    });
                }

                const sub =
                    interaction.options.getSubcommand();

                // ==============================================
                // ADD
                // ==============================================

                if (sub === "add") {

                    const target =
                        interaction.options.getUser(
                            "usuario"
                        );

                    const amount =
                        interaction.options.getInteger(
                            "cantidad"
                        );

                    const user =
                        getUser(
                            guildId,
                            target.id
                        );

                    user.balance +=
                        amount;

                    user.totalEarned +=
                        amount;

                    saveDatabase();

                    return interaction.reply({
                        content:
                            `✅ Se añadieron **${guild.currency.symbol} ${money(amount)}** a ${target}.`
                    });
                }

                // ==============================================
                // REMOVE
                // ==============================================

                if (sub === "remove") {

                    const target =
                        interaction.options.getUser(
                            "usuario"
                        );

                    const amount =
                        interaction.options.getInteger(
                            "cantidad"
                        );

                    const user =
                        getUser(
                            guildId,
                            target.id
                        );

                    user.balance =
                        Math.max(
                            0,
                            user.balance -
                            amount
                        );

                    user.totalSpent +=
                        amount;

                    saveDatabase();

                    return interaction.reply({
                        content:
                            `✅ Se quitaron **${guild.currency.symbol} ${money(amount)}** a ${target}.`
                    });
                }

                // ==============================================
                // SET
                // ==============================================

                if (sub === "set") {

                    const target =
                        interaction.options.getUser(
                            "usuario"
                        );

                    const amount =
                        interaction.options.getInteger(
                            "cantidad"
                        );

                    const user =
                        getUser(
                            guildId,
                            target.id
                        );

                    user.balance =
                        amount;

                    saveDatabase();

                    return interaction.reply({
                        content:
                            `✅ Balance de ${target}: **${guild.currency.symbol} ${money(amount)}**.`
                    });
                }

                // ==============================================
                // RESET
                // ==============================================

                if (sub === "reset") {

                    const target =
                        interaction.options.getUser(
                            "usuario"
                        );

                    const user =
                        getUser(
                            guildId,
                            target.id
                        );

                    user.balance =
                        guild.settings.startingBalance;

                    user.totalEarned = 0;
                    user.totalSpent = 0;
                    user.dailyUses = 0;
                    user.workUses = 0;
                    user.lastDaily = 0;
                    user.lastWork = 0;

                    saveDatabase();

                    return interaction.reply({
                        content:
                            `♻️ Economía de ${target} reiniciada.`
                    });
                }

                // ==============================================
                // GIVEALL
                // ==============================================

                if (sub === "giveall") {

                    const amount =
                        interaction.options.getInteger(
                            "cantidad"
                        );

                    const users =
                        Object.values(
                            guild.users
                        );

                    for (
                        const user of users
                    ) {

                        user.balance +=
                            amount;

                        user.totalEarned +=
                            amount;
                    }

                    saveDatabase();

                    return interaction.reply({
                        content:
                            `🎁 Se dieron **${guild.currency.symbol} ${money(amount)}** a **${users.length} usuarios**.`
                    });
                }

                // ==============================================
                // STATS
                // ==============================================

                if (sub === "stats") {

                    const users =
                        Object.values(
                            guild.users
                        );

                    let circulation = 0;
                    let earned = 0;
                    let spent = 0;

                    for (
                        const user of users
                    ) {

                        circulation +=
                            Number(
                                user.balance || 0
                            );

                        earned +=
                            Number(
                                user.totalEarned || 0
                            );

                        spent +=
                            Number(
                                user.totalSpent || 0
                            );
                    }

                    return interaction.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(
                                    "📊 ESTADÍSTICAS"
                                )
                                .addFields(
                                    {
                                        name:
                                            "👥 Usuarios",
                                        value:
                                            money(users.length),
                                        inline: true
                                    },
                                    {
                                        name:
                                            "💰 Circulación",
                                        value:
                                            `${guild.currency.symbol} ${money(circulation)}`,
                                        inline: true
                                    },
                                    {
                                        name:
                                            "📈 Ganado",
                                        value:
                                            `${guild.currency.symbol} ${money(earned)}`,
                                        inline: true
                                    },
                                    {
                                        name:
                                            "📉 Gastado",
                                        value:
                                            `${guild.currency.symbol} ${money(spent)}`,
                                        inline: true
                                    }
                                )
                                .setTimestamp()
                        ]
                    });
                }
            }

        } catch (error) {

            console.error(
                "❌ Error en interacción:",
                error
            );

            if (
                interaction.replied ||
                interaction.deferred
            ) {

                return interaction.followUp({
                    content:
                        "❌ Ocurrió un error ejecutando la acción.",
                    ephemeral: true
                });

            }

            return interaction.reply({
                content:
                    "❌ Ocurrió un error ejecutando la acción.",
                ephemeral: true
            });
        }
    }
);

// ============================================================
// PANEL SETUP ECONOMÍA
// ============================================================

async function economySetup(
    interaction,
    update
) {

    const guild =
        getGuild(
            interaction.guild.id
        );

    const status =
        guild.enabled
            ? "🟢 Activada"
            : "🔴 Desactivada";

    const staff =
        guild.staffRole
            ? `<@&${guild.staffRole}>`
            : "❌ No configurado";

    const embed =
        new EmbedBuilder()
            .setTitle(
                "꒰ 💰 ꒱・SOCIAL WORLD ECONOMY"
            )
            .setDescription(
                [
                    "Panel de configuración de economía.",
                    "",
                    `⚙️ **Estado:** ${status}`,
                    `🛡️ **Staff Economy:** ${staff}`,
                    `💵 **Moneda:** ${guild.currency.symbol} ${guild.currency.name}`,
                    "",
                    `💰 **Balance inicial:** ${money(guild.settings.startingBalance)}`,
                    "",
                    `🎁 **Daily:** ${money(guild.settings.dailyMin)} - ${money(guild.settings.dailyMax)}`,
                    `💼 **Work:** ${money(guild.settings.workMin)} - ${money(guild.settings.workMax)}`,
                    "",
                    `⏰ **Daily:** ${duration(guild.settings.dailyCooldown)}`,
                    `⏰ **Work:** ${duration(guild.settings.workCooldown)}`,
                    "",
                    `💸 **Pay:** ${guild.settings.payEnabled ? "🟢 ON" : "🔴 OFF"}`,
                    `🏆 **Leaderboard:** ${guild.settings.leaderboardEnabled ? "🟢 ON" : "🔴 OFF"}`,
                    "",
                    "Selecciona una opción para configurar el sistema."
                ].join("\n")
            )
            .setFooter({
                text:
                    "Social World • Configuración por servidor"
            })
            .setTimestamp();

    const row1 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "eco_staff"
                    )
                    .setLabel(
                        "Staff Economy"
                    )
                    .setEmoji("🛡️")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "eco_currency"
                    )
                    .setLabel(
                        "Moneda"
                    )
                    .setEmoji("💰")
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "eco_rewards"
                    )
                    .setLabel(
                        "Recompensas"
                    )
                    .setEmoji("🎁")
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );

    const row2 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "eco_cooldowns"
                    )
                    .setLabel(
                        "Cooldowns"
                    )
                    .setEmoji("⏰")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "eco_pay"
                    )
                    .setLabel(
                        "Pay"
                    )
                    .setEmoji("💸")
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "eco_leaderboard"
                    )
                    .setLabel(
                        "Leaderboard"
                    )
                    .setEmoji("🏆")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
            );

    const row3 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "eco_enable"
                    )
                    .setLabel(
                        "Activar"
                    )
                    .setEmoji("🟢")
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "eco_disable"
                    )
                    .setLabel(
                        "Desactivar"
                    )
                    .setEmoji("🔴")
                    .setStyle(
                        ButtonStyle.Danger
                    )
            );

    if (update) {

        return interaction.update({
            embeds: [embed],
            components: [
                row1,
                row2,
                row3
            ]
        });
    }

    return interaction.reply({
        embeds: [embed],
        components: [
            row1,
            row2,
            row3
        ]
    });
}

// ============================================================
// LOGIN
// ============================================================

if (TOKEN) {

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

} else {

    console.error(
        "❌ No se encontró TOKEN en las variables de entorno."
    );
}

// ============================================================
// ERRORES
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
