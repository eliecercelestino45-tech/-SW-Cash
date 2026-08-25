require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");

const {
    Client,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
    SlashCommandBuilder,
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
    PermissionFlagsBits
} = require("discord.js");

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
    console.error("❌ Falta TOKEN en las variables de entorno.");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("❌ Falta CLIENT_ID en las variables de entorno.");
    process.exit(1);
}

const PORT = process.env.PORT || 3000;

const INITIAL_BUDGET = 10000000000;
const DAILY_AMOUNT = 25000;
const WORK_MIN = 5000;
const WORK_MAX = 25000;

// ============================================================
// CLIENTE DISCORD
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ],
    partials: [
        Partials.Channel
    ]
});

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
        bot: client.user ? client.user.tag : "connecting",
        servers: client.guilds.cache.size,
        uptime: process.uptime()
    });
});

app.listen(PORT, () => {
    console.log(`🌐 PORT ${PORT} iniciado correctamente.`);
});

// ============================================================
// CARPETA DATA
// ============================================================

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

// ============================================================
// ARCHIVOS JSON
// ============================================================

const FILES = {
    users: path.join(DATA_DIR, "users.json"),
    guilds: path.join(DATA_DIR, "guilds.json"),
    transactions: path.join(DATA_DIR, "transactions.json"),
    cooldowns: path.join(DATA_DIR, "cooldowns.json"),
    properties: path.join(DATA_DIR, "properties.json"),
    vehicles: path.join(DATA_DIR, "vehicles.json"),
    missions: path.join(DATA_DIR, "missions.json"),
    auctions: path.join(DATA_DIR, "auctions.json")
};

function ensureFile(file, fallback) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(
            file,
            JSON.stringify(fallback, null, 2)
        );
    }
}

ensureFile(FILES.users, {});
ensureFile(FILES.guilds, {});
ensureFile(FILES.transactions, []);
ensureFile(FILES.cooldowns, {});
ensureFile(FILES.properties, {});
ensureFile(FILES.vehicles, {});
ensureFile(FILES.missions, {});
ensureFile(FILES.auctions, []);

// ============================================================
// JSON HELPERS
// ============================================================

function readJSON(file, fallback) {
    try {
        return JSON.parse(
            fs.readFileSync(file, "utf8")
        );
    } catch {
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2)
    );
}

function users() {
    return readJSON(FILES.users, {});
}

function guilds() {
    return readJSON(FILES.guilds, {});
}

function transactions() {
    return readJSON(FILES.transactions, []);
}

function cooldowns() {
    return readJSON(FILES.cooldowns, {});
}

// ============================================================
// SERVIDOR
// ============================================================

function getGuildData(guildId) {
    const data = guilds();

    if (!data[guildId]) {
        data[guildId] = {
            budget: INITIAL_BUDGET,
            emoji: "💵",
            currency: "USD",
            logsChannel: null,
            economyChannel: null,
            prefix: "$",
            tax: 0,
            configured: false,
            jobs: true,
            market: true,
            properties: true,
            vip: true,
            createdAt: Date.now()
        };

        writeJSON(FILES.guilds, data);
    }

    return data[guildId];
}

function saveGuildData(guildId, guildData) {
    const data = guilds();
    data[guildId] = guildData;
    writeJSON(FILES.guilds, data);
}

// ============================================================
// USUARIOS
// ============================================================

function getUserData(guildId, userId) {
    const data = users();

    if (!data[guildId]) {
        data[guildId] = {};
    }

    if (!data[guildId][userId]) {
        data[guildId][userId] = {
            wallet: 0,
            bank: 0,
            job: null,
            salary: 0,
            level: 1,
            xp: 0,
            streak: 0,
            lastDaily: 0,
            lastWork: 0,
            lastBonus: 0,
            lastShift: 0,
            vip: false,
            skills: {},
            inventory: [],
            properties: [],
            vehicles: [],
            achievements: [],
            missions: [],
            createdAt: Date.now()
        };

        writeJSON(FILES.users, data);
    }

    return data[guildId][userId];
}

function saveUserData(guildId, userId, userData) {
    const data = users();

    if (!data[guildId]) {
        data[guildId] = {};
    }

    data[guildId][userId] = userData;

    writeJSON(FILES.users, data);
}

// ============================================================
// DINERO
// ============================================================

function totalMoney(user) {
    return Number(user.wallet || 0) +
        Number(user.bank || 0);
}

function formatMoney(amount) {
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
        }
    ).format(Math.max(0, Number(amount) || 0));
}

function randomMoney(min, max) {
    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;
}

function addMoney(guildId, userId, amount, location = "wallet") {
    const user = getUserData(guildId, userId);

    if (location === "bank") {
        user.bank += amount;
    } else {
        user.wallet += amount;
    }

    saveUserData(guildId, userId, user);

    return user;
}

function removeMoney(guildId, userId, amount, location = "wallet") {
    const user = getUserData(guildId, userId);

    if (location === "bank") {
        user.bank = Math.max(
            0,
            user.bank - amount
        );
    } else {
        user.wallet = Math.max(
            0,
            user.wallet - amount
        );
    }

    saveUserData(guildId, userId, user);

    return user;
}

// ============================================================
// TRANSACCIONES
// ============================================================

function addTransaction(guildId, from, to, amount, type) {
    const data = transactions();

    data.push({
        id: Date.now().toString(),
        guildId,
        from,
        to,
        amount,
        type,
        date: new Date().toISOString()
    });

    writeJSON(FILES.transactions, data.slice(-5000));
}

// ============================================================
// COOLDOWNS
// ============================================================

function checkCooldown(guildId, userId, command, ms) {
    const data = cooldowns();

    const key = `${guildId}:${userId}:${command}`;

    if (!data[key]) {
        return 0;
    }

    const remaining =
        ms - (Date.now() - data[key]);

    return remaining > 0
        ? remaining
        : 0;
}

function setCooldown(guildId, userId, command) {
    const data = cooldowns();

    const key = `${guildId}:${userId}:${command}`;

    data[key] = Date.now();

    writeJSON(FILES.cooldowns, data);
}

function formatTime(ms) {
    const seconds = Math.ceil(ms / 1000);

    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes = Math.ceil(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m`;
    }

    return `${Math.ceil(minutes / 60)}h`;
}

// ============================================================
// EMBEDS
// ============================================================

function economyEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0x7B2CFF)
        .setTitle(`🟣 ${title}`)
        .setDescription(description)
        .setTimestamp();
}

function errorEmbed(message) {
    return new EmbedBuilder()
        .setColor(0xFF3B3B)
        .setTitle("❌ Error")
        .setDescription(message);
}

// ============================================================
// LOGS
// ============================================================

async function sendLog(guild, message) {
    try {
        const config = getGuildData(guild.id);

        if (!config.logsChannel) return;

        const channel =
            guild.channels.cache.get(
                config.logsChannel
            );

        if (!channel) return;

        await channel.send({
            embeds: [
                economyEmbed(
                    "Registro económico",
                    message
                )
            ]
        });
    } catch {}
}

// ============================================================
// PRESUPUESTO
// ============================================================

function canUseBudget(guildId, amount) {
    const config = getGuildData(guildId);

    return config.budget >= amount;
}

function spendBudget(guildId, amount) {
    const config = getGuildData(guildId);

    config.budget = Math.max(
        0,
        config.budget - amount
    );

    saveGuildData(guildId, config);

    return config.budget;
}

function addBudget(guildId, amount) {
    const config = getGuildData(guildId);

    config.budget += amount;

    saveGuildData(guildId, config);

    return config.budget;
}

// ============================================================
// COMANDOS
// ============================================================

const commands = [];

// ------------------------------------------------------------
// BÁSICOS
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("balance")
        .setDescription("Ver tu saldo"),

    new SlashCommandBuilder()
        .setName("money")
        .setDescription("Ver tu dinero total"),

    new SlashCommandBuilder()
        .setName("wallet")
        .setDescription("Ver tu cartera"),

    new SlashCommandBuilder()
        .setName("bankbalance")
        .setDescription("Ver tu banco"),

    new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Reclamar tu recompensa diaria"),

    new SlashCommandBuilder()
        .setName("work")
        .setDescription("Trabajar y ganar dinero"),

    new SlashCommandBuilder()
        .setName("deposit")
        .setDescription("Depositar dinero")
        .addIntegerOption(o =>
            o.setName("cantidad")
                .setDescription("Cantidad")
                .setRequired(true)
                .setMinValue(1)
        ),

    new SlashCommandBuilder()
        .setName("withdraw")
        .setDescription("Retirar dinero")
        .addIntegerOption(o =>
            o.setName("cantidad")
                .setDescription("Cantidad")
                .setRequired(true)
                .setMinValue(1)
        ),

    new SlashCommandBuilder()
        .setName("depositall")
        .setDescription("Depositar todo"),

    new SlashCommandBuilder()
        .setName("withdrawall")
        .setDescription("Retirar todo"),

    new SlashCommandBuilder()
        .setName("send")
        .setDescription("Enviar dinero")
        .addUserOption(o =>
            o.setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("cantidad")
                .setDescription("Cantidad")
                .setRequired(true)
                .setMinValue(1)
        ),

    new SlashCommandBuilder()
        .setName("request")
        .setDescription("Solicitar dinero")
        .addUserOption(o =>
            o.setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("cantidad")
                .setDescription("Cantidad")
                .setRequired(true)
                .setMinValue(1)
        ),

    new SlashCommandBuilder()
        .setName("split")
        .setDescription("Dividir dinero")
        .addIntegerOption(o =>
            o.setName("cantidad")
                .setDescription("Cantidad")
                .setRequired(true)
                .setMinValue(1)
        )
);

// ------------------------------------------------------------
// BANCO
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("interest")
        .setDescription("Consultar intereses"),

    new SlashCommandBuilder()
        .setName("transaction")
        .setDescription("Consultar transacciones"),

    new SlashCommandBuilder()
        .setName("history")
        .setDescription("Ver historial económico")
);

// ------------------------------------------------------------
// TRABAJOS
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("jobs")
        .setDescription("Ver trabajos disponibles"),

    new SlashCommandBuilder()
        .setName("job")
        .setDescription("Ver tu trabajo"),

    new SlashCommandBuilder()
        .setName("apply")
        .setDescription("Solicitar un trabajo")
        .addStringOption(o =>
            o.setName("trabajo")
                .setDescription("Trabajo")
                .setRequired(true)
                .addChoices(
                    {
                        name: "Programador",
                        value: "programador"
                    },
                    {
                        name: "Diseñador",
                        value: "diseñador"
                    },
                    {
                        name: "Vendedor",
                        value: "vendedor"
                    },
                    {
                        name: "Médico",
                        value: "medico"
                    },
                    {
                        name: "Abogado",
                        value: "abogado"
                    }
                )
        ),

    new SlashCommandBuilder()
        .setName("resign")
        .setDescription("Renunciar a tu trabajo"),

    new SlashCommandBuilder()
        .setName("promote")
        .setDescription("Consultar promoción"),

    new SlashCommandBuilder()
        .setName("salary")
        .setDescription("Consultar salario"),

    new SlashCommandBuilder()
        .setName("shift")
        .setDescription("Comenzar turno"),

    new SlashCommandBuilder()
        .setName("bonus")
        .setDescription("Consultar bonificación"),

    new SlashCommandBuilder()
        .setName("career")
        .setDescription("Ver tu carrera"),

    new SlashCommandBuilder()
        .setName("skills")
        .setDescription("Ver tus habilidades")
);

// ------------------------------------------------------------
// COMERCIO
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("market")
        .setDescription("Ver el mercado"),

    new SlashCommandBuilder()
        .setName("auction")
        .setDescription("Ver subastas"),

    new SlashCommandBuilder()
        .setName("bid")
        .setDescription("Pujar en una subasta")
        .addIntegerOption(o =>
            o.setName("cantidad")
                .setDescription("Cantidad")
                .setRequired(true)
                .setMinValue(1)
        ),

    new SlashCommandBuilder()
        .setName("list")
        .setDescription("Poner un objeto a la venta")
        .addStringOption(o =>
            o.setName("objeto")
                .setDescription("Objeto")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("precio")
                .setDescription("Precio")
                .setRequired(true)
                .setMinValue(1)
        ),

    new SlashCommandBuilder()
        .setName("cancel-sale")
        .setDescription("Cancelar una venta"),

    new SlashCommandBuilder()
        .setName("trade")
        .setDescription("Intercambiar objetos")
        .addUserOption(o =>
            o.setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("offer")
        .setDescription("Hacer una oferta")
        .addUserOption(o =>
            o.setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("cantidad")
                .setDescription("Cantidad")
                .setRequired(true)
                .setMinValue(1)
        ),

    new SlashCommandBuilder()
        .setName("accept")
        .setDescription("Aceptar una oferta"),

    new SlashCommandBuilder()
        .setName("decline")
        .setDescription("Rechazar una oferta"),

    new SlashCommandBuilder()
        .setName("price")
        .setDescription("Consultar precio")
        .addStringOption(o =>
            o.setName("objeto")
                .setDescription("Objeto")
                .setRequired(true)
        )
);

// ------------------------------------------------------------
// PROPIEDADES
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("property")
        .setDescription("Ver tu propiedad"),

    new SlashCommandBuilder()
        .setName("properties")
        .setDescription("Ver propiedades disponibles"),

    new SlashCommandBuilder()
        .setName("buyhouse")
        .setDescription("Comprar una casa"),

    new SlashCommandBuilder()
        .setName("sellhouse")
        .setDescription("Vender tu casa"),

    new SlashCommandBuilder()
        .setName("rent")
        .setDescription("Alquilar una propiedad"),

    new SlashCommandBuilder()
        .setName("upgradehouse")
        .setDescription("Mejorar tu casa"),

    new SlashCommandBuilder()
        .setName("garage")
        .setDescription("Ver tu garaje"),

    new SlashCommandBuilder()
        .setName("vehicle")
        .setDescription("Ver tu vehículo"),

    new SlashCommandBuilder()
        .setName("buyvehicle")
        .setDescription("Comprar un vehículo")
);

// ------------------------------------------------------------
// MISIONES Y LOGROS
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("missions")
        .setDescription("Ver misiones disponibles"),

    new SlashCommandBuilder()
        .setName("mission")
        .setDescription("Ver misión actual"),

    new SlashCommandBuilder()
        .setName("claim")
        .setDescription("Reclamar recompensa"),

    new SlashCommandBuilder()
        .setName("achievements")
        .setDescription("Ver logros"),

    new SlashCommandBuilder()
        .setName("achievement")
        .setDescription("Ver detalles de un logro"),

    new SlashCommandBuilder()
        .setName("rewards")
        .setDescription("Ver recompensas"),

    new SlashCommandBuilder()
        .setName("streak")
        .setDescription("Ver tu racha"),

    new SlashCommandBuilder()
        .setName("milestones")
        .setDescription("Ver tus hitos")
);

// ------------------------------------------------------------
// EVENTOS
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("event")
        .setDescription("Ver evento activo"),

    new SlashCommandBuilder()
        .setName("events")
        .setDescription("Ver eventos disponibles"),

    new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Ver sorteo económico"),

    new SlashCommandBuilder()
        .setName("raffle")
        .setDescription("Ver rifa"),

    new SlashCommandBuilder()
        .setName("jackpot")
        .setDescription("Ver jackpot"),

    new SlashCommandBuilder()
        .setName("bonusday")
        .setDescription("Ver bonificación del día"),

    new SlashCommandBuilder()
        .setName("doublemoney")
        .setDescription("Ver evento x2")
);

// ------------------------------------------------------------
// VIP
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("vip")
        .setDescription("Información VIP"),

    new SlashCommandBuilder()
        .setName("vipshop")
        .setDescription("Tienda VIP"),

    new SlashCommandBuilder()
        .setName("vipbonus")
        .setDescription("Bono VIP"),

    new SlashCommandBuilder()
        .setName("vipdaily")
        .setDescription("Recompensa diaria VIP"),

    new SlashCommandBuilder()
        .setName("vipstats")
        .setDescription("Estadísticas VIP")
);

// ------------------------------------------------------------
// ESTADÍSTICAS
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("economy")
        .setDescription("Estadísticas generales"),

    new SlashCommandBuilder()
        .setName("economystats")
        .setDescription("Estadísticas del servidor"),

    new SlashCommandBuilder()
        .setName("circulation")
        .setDescription("Dinero en circulación"),

    new SlashCommandBuilder()
        .setName("inflation")
        .setDescription("Estado económico"),

    new SlashCommandBuilder()
        .setName("income")
        .setDescription("Ver ingresos"),

    new SlashCommandBuilder()
        .setName("expenses")
        .setDescription("Ver gastos"),

    new SlashCommandBuilder()
        .setName("taxes")
        .setDescription("Ver impuestos"),

    new SlashCommandBuilder()
        .setName("tax")
        .setDescription("Consultar impuestos")
);

// ------------------------------------------------------------
// RANKING
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Ver ranking económico"),

    new SlashCommandBuilder()
        .setName("richest")
        .setDescription("Ver usuarios más ricos")
);

// ------------------------------------------------------------
// CONFIGURACIÓN
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configurar SW Economy"),

    new SlashCommandBuilder()
        .setName("config")
        .setDescription("Ver configuración"),

    new SlashCommandBuilder()
        .setName("guía")
        .setDescription("Recibir la guía de SW Economy por MD")
);

// ------------------------------------------------------------
// ECO ADMIN
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("eco")
        .setDescription("Administración avanzada de economía")
        .addSubcommand(s =>
            s.setName("ban")
                .setDescription("Bloquear economía")
                .addUserOption(o =>
                    o.setName("usuario")
                        .setDescription("Usuario")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("unban")
                .setDescription("Desbloquear economía")
                .addUserOption(o =>
                    o.setName("usuario")
                        .setDescription("Usuario")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("freeze")
                .setDescription("Congelar saldo")
                .addUserOption(o =>
                    o.setName("usuario")
                        .setDescription("Usuario")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("unfreeze")
                .setDescription("Descongelar saldo")
                .addUserOption(o =>
                    o.setName("usuario")
                        .setDescription("Usuario")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("audit")
                .setDescription("Revisar movimientos")
        )
        .addSubcommand(s =>
            s.setName("logs")
                .setDescription("Configurar registros")
                .addChannelOption(o =>
                    o.setName("canal")
                        .setDescription("Canal de logs")
                        .setRequired(true)
                )
        )
        .addSubcommand(s =>
            s.setName("tax")
                .setDescription("Configurar impuestos")
                .addIntegerOption(o =>
                    o.setName("porcentaje")
                        .setDescription("Porcentaje")
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(100)
                )
        )
        .addSubcommand(s =>
            s.setName("reward")
                .setDescription("Agregar dinero al presupuesto")
                .addIntegerOption(o =>
                    o.setName("cantidad")
                        .setDescription("Cantidad")
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(s =>
            s.setName("maintenance")
                .setDescription("Modo mantenimiento")
                .addBooleanOption(o =>
                    o.setName("estado")
                        .setDescription("Activar/desactivar")
                        .setRequired(true)
                )
        )
);

// ============================================================
// HELP
// ============================================================

commands.push(
    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Ver todos los comandos")
);

// ============================================================
// REGISTRAR COMANDOS
// ============================================================

async function registerCommands() {
    try {
        const rest = new REST({
            version: "10"
        }).setToken(TOKEN);

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: commands.map(command =>
                    command.toJSON()
                )
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
// SETUP
// ============================================================

function setupEmbed(step = 1) {
    const descriptions = {
        1:
            "### ⚙️ PASO 1 — Economía\n\n" +
            "Configura la moneda, emoji, presupuesto y prefijo.\n\n" +
            "💰 Presupuesto inicial: `$10,000,000,000`\n" +
            "💵 Moneda: USD",

        2:
            "### 📢 PASO 2 — Canales\n\n" +
            "Selecciona los canales que utilizará SW Economy.\n\n" +
            "🔎 Puedes buscar y seleccionar el canal.",

        3:
            "### 👑 PASO 3 — Roles\n\n" +
            "Selecciona los roles relacionados con la economía.\n\n" +
            "🔎 Puedes buscar el rol.",

        4:
            "### 💼 PASO 4 — Sistema\n\n" +
            "Configura trabajos, mercado, propiedades, VIP y eventos.",

        5:
            "### 💳 PASO 5 — Presupuesto\n\n" +
            "Configura el funcionamiento del presupuesto del servidor.\n\n" +
            "Cuando llegue a `$0`, SW Economy podrá mostrar el sistema de préstamo.",

        6:
            "### 📋 PASO 6 — Logs\n\n" +
            "Selecciona el canal donde se registrarán las operaciones económicas."
    };

    return new EmbedBuilder()
        .setColor(0x7B2CFF)
        .setTitle("🟣 SW ECONOMY • CONFIGURACIÓN")
        .setDescription(
            descriptions[step] ||
            descriptions[1]
        )
        .setFooter({
            text: `Paso ${step}/6 • SW Economy`
        });
}

function setupButtons(step) {
    const row = new ActionRowBuilder();

    if (step > 1) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`setup_back_${step}`)
                .setLabel("Atrás")
                .setEmoji("◀️")
                .setStyle(ButtonStyle.Secondary)
        );
    }

    if (step < 6) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`setup_next_${step}`)
                .setLabel("Siguiente")
                .setEmoji("▶️")
                .setStyle(ButtonStyle.Primary)
        );
    } else {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId("setup_finish")
                .setLabel("Finalizar")
                .setEmoji("✅")
                .setStyle(ButtonStyle.Success)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId("setup_close")
            .setLabel("Cerrar")
            .setEmoji("✖️")
            .setStyle(ButtonStyle.Danger)
    );

    return row;
}

function setupSelectors(step) {
    const rows = [];

    if (step === 2) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId("setup_economy_channel")
                    .setPlaceholder("🔎 Buscar canal de economía")
                    .setChannelTypes(0)
            )
        );
    }

    if (step === 3) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId("setup_economy_role")
                    .setPlaceholder("🔎 Buscar rol")
                    .setMinValues(0)
                    .setMaxValues(1)
            )
        );
    }

    if (step === 6) {
        rows.push(
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId("setup_logs_channel")
                    .setPlaceholder("🔎 Buscar canal de logs")
                    .setChannelTypes(0)
            )
        );
    }

    return rows;
}

// ============================================================
// GUÍA
// ============================================================

function createGuide() {
    return new EmbedBuilder()
        .setColor(0x7B2CFF)
        .setTitle("📖 GUÍA OFICIAL • SW ECONOMY")
        .setDescription(
            "Bienvenido a **SW Economy**.\n\n" +
            "💰 Sistema completo de economía.\n" +
            "💼 Trabajos y salarios.\n" +
            "🏪 Mercado y comercio.\n" +
            "🏠 Propiedades y vehículos.\n" +
            "🎯 Misiones y logros.\n" +
            "🎁 Eventos económicos.\n" +
            "👑 Sistema VIP.\n" +
            "📊 Estadísticas.\n" +
            "🔐 Administración avanzada.\n\n" +
            "### 💵 Comandos principales\n" +
            "`/balance` • `/daily` • `/work` • `/send`\n" +
            "`/deposit` • `/withdraw` • `/market`\n" +
            "`/jobs` • `/missions` • `/vip`\n\n" +
            "### ⚙️ Configuración\n" +
            "`/setup`\n\n" +
            "### 📊 Administración\n" +
            "`/eco`\n\n" +
            "Si necesitas ayuda utiliza `/help`."
        )
        .setFooter({
            text: "SW Economy • Sistema global"
        });
}

// ============================================================
// INTERACCIONES
// ============================================================

client.on("interactionCreate", async interaction => {
    try {
        if (!interaction.isChatInputCommand() &&
            !interaction.isButton() &&
            !interaction.isChannelSelectMenu() &&
            !interaction.isRoleSelectMenu()) {
            return;
        }

        if (!interaction.guild) {
            if (
                interaction.isChatInputCommand() &&
                interaction.commandName !== "guía"
            ) {
                return interaction.reply({
                    content: "❌ Este comando solamente funciona dentro de un servidor.",
                    ephemeral: true
                });
            }
        }

        // ====================================================
        // GUÍA
        // ====================================================

        if (
            interaction.isChatInputCommand() &&
            interaction.commandName === "guía"
        ) {
            try {
                await interaction.user.send({
                    embeds: [createGuide()]
                });

                return interaction.reply({
                    content: "📖 Te envié la guía por MD.",
                    ephemeral: true
                });
            } catch {
                return interaction.reply({
                    content:
                        "❌ No pude enviarte MD. Activa los mensajes directos.",
                    ephemeral: true
                });
            }
        }

        // ====================================================
        // SETUP
        // ====================================================

        if (
            interaction.isChatInputCommand() &&
            interaction.commandName === "setup"
        ) {
            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                return interaction.reply({
                    content:
                        "❌ Necesitas permiso de **Administrar servidor**.",
                    ephemeral: true
                });
            }

            return interaction.reply({
                embeds: [
                    setupEmbed(1)
                ],
                components: [
                    setupButtons(1),
                    ...setupSelectors(1)
                ],
                ephemeral: true
            });
        }

        if (
            interaction.isButton() &&
            interaction.customId.startsWith("setup_")
        ) {
            if (
                interaction.customId === "setup_close"
            ) {
                return interaction.update({
                    content: "⚙️ Configuración cerrada.",
                    embeds: [],
                    components: []
                });
            }

            if (
                interaction.customId === "setup_finish"
            ) {
                const config =
                    getGuildData(interaction.guild.id);

                config.configured = true;

                saveGuildData(
                    interaction.guild.id,
                    config
                );

                await sendLog(
                    interaction.guild,
                    `⚙️ ${interaction.user} finalizó la configuración de SW Economy.`
                );

                return interaction.update({
                    embeds: [
                        economyEmbed(
                            "Configuración completada",
                            "✅ SW Economy ha sido configurado correctamente."
                        )
                    ],
                    components: []
                });
            }

            const parts =
                interaction.customId.split("_");

            const action = parts[1];
            const current = Number(parts[2]);

            let next = current;

            if (action === "next") {
                next = Math.min(6, current + 1);
            }

            if (action === "back") {
                next = Math.max(1, current - 1);
            }

            return interaction.update({
                embeds: [
                    setupEmbed(next)
                ],
                components: [
                    setupButtons(next),
                    ...setupSelectors(next)
                ]
            });
        }

        // ====================================================
        // SELECTORES SETUP
        // ====================================================

        if (
            interaction.isChannelSelectMenu()
        ) {
            const config =
                getGuildData(interaction.guild.id);

            const channel =
                interaction.channels.first();

            if (
                interaction.customId ===
                "setup_economy_channel"
            ) {
                config.economyChannel =
                    channel.id;

                saveGuildData(
                    interaction.guild.id,
                    config
                );

                return interaction.reply({
                    content:
                        `✅ Canal de economía configurado: ${channel}`,
                    ephemeral: true
                });
            }

            if (
                interaction.customId ===
                "setup_logs_channel"
            ) {
                config.logsChannel =
                    channel.id;

                saveGuildData(
                    interaction.guild.id,
                    config
                );

                return interaction.reply({
                    content:
                        `📋 Canal de logs configurado: ${channel}`,
                    ephemeral: true
                });
            }
        }

        if (
            interaction.isRoleSelectMenu()
        ) {
            return interaction.reply({
                content:
                    `👑 Rol configurado correctamente: <@&${interaction.values[0]}>`,
                ephemeral: true
            });
        }

        // ====================================================
        // DATOS
        // ====================================================

        const guildId =
            interaction.guild.id;

        const userId =
            interaction.user.id;

        const config =
            getGuildData(guildId);

        const user =
            getUserData(
                guildId,
                userId
            );

        const command =
            interaction.commandName;

        // ====================================================
        // BALANCE
        // ====================================================

        if (command === "balance" ||
            command === "money") {

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Tu economía",
                        `💵 Cartera: **${formatMoney(user.wallet)}**\n` +
                        `🏦 Banco: **${formatMoney(user.bank)}**\n` +
                        `💰 Total: **${formatMoney(totalMoney(user))}**`
                    )
                ]
            });
        }

        // ====================================================
        // WALLET
        // ====================================================

        if (command === "wallet") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Cartera",
                        `💵 Tienes **${formatMoney(user.wallet)}** en tu cartera.`
                    )
                ]
            });
        }

        // ====================================================
        // BANCO
        // ====================================================

        if (command === "bankbalance") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Banco",
                        `🏦 Tienes **${formatMoney(user.bank)}** en el banco.`
                    )
                ]
            });
        }

        // ====================================================
        // DAILY
        // ====================================================

        if (command === "daily") {
            const remaining =
                checkCooldown(
                    guildId,
                    userId,
                    "daily",
                    86400000
                );

            if (remaining > 0) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            `⏳ Ya reclamaste tu recompensa. Vuelve en **${formatTime(remaining)}**.`
                        )
                    ],
                    ephemeral: true
                });
            }

            const reward =
                user.vip
                    ? DAILY_AMOUNT * 2
                    : DAILY_AMOUNT;

            if (!canUseBudget(guildId, reward)) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "El presupuesto del servidor se agotó. 💸"
                        )
                    ]
                });
            }

            spendBudget(
                guildId,
                reward
            );

            addMoney(
                guildId,
                userId,
                reward
            );

            user.streak += 1;

            saveUserData(
                guildId,
                userId,
                user
            );

            setCooldown(
                guildId,
                userId,
                "daily"
            );

            await sendLog(
                interaction.guild,
                `🎁 ${interaction.user.tag} recibió ${formatMoney(reward)} de daily.`
            );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Recompensa diaria",
                        `🎁 Recibiste **${formatMoney(reward)}**.\n🔥 Racha: **${user.streak}**`
                    )
                ]
            });
        }

        // ====================================================
        // WORK
        // ====================================================

        if (command === "work") {
            const remaining =
                checkCooldown(
                    guildId,
                    userId,
                    "work",
                    3600000
                );

            if (remaining > 0) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            `⏳ Debes esperar **${formatTime(remaining)}**.`
                        )
                    ],
                    ephemeral: true
                });
            }

            const amount =
                randomMoney(
                    WORK_MIN,
                    WORK_MAX
                );

            if (!canUseBudget(guildId, amount)) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "El presupuesto del servidor se agotó."
                        )
                    ]
                });
            }

            spendBudget(
                guildId,
                amount
            );

            addMoney(
                guildId,
                userId,
                amount
            );

            setCooldown(
                guildId,
                userId,
                "work"
            );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Trabajo completado",
                        `💼 Ganaste **${formatMoney(amount)}**.`
                    )
                ]
            });
        }

        // ====================================================
        // DEPOSIT
        // ====================================================

        if (command === "deposit") {
            const amount =
                interaction.options.getInteger(
                    "cantidad"
                );

            if (user.wallet < amount) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "No tienes suficiente dinero en tu cartera."
                        )
                    ]
                });
            }

            user.wallet -= amount;
            user.bank += amount;

            saveUserData(
                guildId,
                userId,
                user
            );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Depósito",
                        `🏦 Depositaste **${formatMoney(amount)}**.`
                    )
                ]
            });
        }

        // ====================================================
        // WITHDRAW
        // ====================================================

        if (command === "withdraw") {
            const amount =
                interaction.options.getInteger(
                    "cantidad"
                );

            if (user.bank < amount) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "No tienes suficiente dinero en el banco."
                        )
                    ]
                });
            }

            user.bank -= amount;
            user.wallet += amount;

            saveUserData(
                guildId,
                userId,
                user
            );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Retiro",
                        `💵 Retiraste **${formatMoney(amount)}**.`
                    )
                ]
            });
        }

        // ====================================================
        // DEPOSIT ALL
        // ====================================================

        if (command === "depositall") {
            const amount = user.wallet;

            user.wallet = 0;
            user.bank += amount;

            saveUserData(
                guildId,
                userId,
                user
            );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Depósito total",
                        `🏦 Depositaste **${formatMoney(amount)}**.`
                    )
                ]
            });
        }

        // ====================================================
        // WITHDRAW ALL
        // ====================================================

        if (command === "withdrawall") {
            const amount = user.bank;

            user.bank = 0;
            user.wallet += amount;

            saveUserData(
                guildId,
                userId,
                user
            );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Retiro total",
                        `💵 Retiraste **${formatMoney(amount)}**.`
                    )
                ]
            });
        }

        // ====================================================
        // SEND
        // ====================================================

        if (command === "send") {
            const target =
                interaction.options.getUser(
                    "usuario"
                );

            const amount =
                interaction.options.getInteger(
                    "cantidad"
                );

            if (target.bot) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "No puedes enviar dinero a bots."
                        )
                    ]
                });
            }

            if (
                target.id === userId
            ) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "No puedes enviarte dinero a ti mismo."
                        )
                    ]
                });
            }

            if (user.wallet < amount) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "No tienes suficiente dinero."
                        )
                    ]
                });
            }

            const tax =
                Math.floor(
                    amount *
                    (config.tax / 100)
                );

            const received =
                amount - tax;

            user.wallet -= amount;

            saveUserData(
                guildId,
                userId,
                user
            );

            addMoney(
                guildId,
                target.id,
                received
            );

            addTransaction(
                guildId,
                userId,
                target.id,
                amount,
                "send"
            );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Transferencia",
                        `💸 Enviaste **${formatMoney(amount)}** a ${target}.\n` +
                        `💰 Recibirá: **${formatMoney(received)}**`
                    )
                ]
            });
        }

        // ====================================================
        // REQUEST
        // ====================================================

        if (command === "request") {
            const target =
                interaction.options.getUser(
                    "usuario"
                );

            const amount =
                interaction.options.getInteger(
                    "cantidad"
                );

            return interaction.reply({
                content:
                    `💸 ${target}, ${interaction.user} te solicita **${formatMoney(amount)}**.`,
                allowedMentions: {
                    users: [
                        target.id
                    ]
                }
            });
        }

        // ====================================================
        // INTEREST
        // ====================================================

        if (command === "interest") {
            const interest =
                Math.floor(
                    user.bank * 0.02
                );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Intereses",
                        `🏦 Tu banco genera aproximadamente **${formatMoney(interest)}** de interés al 2%.`
                    )
                ]
            });
        }

        // ====================================================
        // JOBS
        // ====================================================

        if (command === "jobs") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Trabajos disponibles",
                        "💻 **Programador** — $20,000\n" +
                        "🎨 **Diseñador** — $18,000\n" +
                        "🛒 **Vendedor** — $15,000\n" +
                        "🏥 **Médico** — $25,000\n" +
                        "⚖️ **Abogado** — $23,000"
                    )
                ]
            });
        }

        // ====================================================
        // JOB
        // ====================================================

        if (command === "job") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Tu trabajo",
                        user.job
                            ? `💼 Trabajo: **${user.job}**\n💰 Salario: **${formatMoney(user.salary)}**`
                            : "❌ Actualmente no tienes trabajo."
                    )
                ]
            });
        }

        // ====================================================
        // APPLY
        // ====================================================

        if (command === "apply") {
            const job =
                interaction.options.getString(
                    "trabajo"
                );

            const salaries = {
                programador: 20000,
                diseñador: 18000,
                vendedor: 15000,
                medico: 25000,
                abogado: 23000
            };

            user.job = job;
            user.salary =
                salaries[job] || 10000;

            saveUserData(
                guildId,
                userId,
                user
            );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Trabajo obtenido",
                        `💼 Ahora trabajas como **${job}**.\n💰 Salario: **${formatMoney(user.salary)}**`
                    )
                ]
            });
        }

        // ====================================================
        // RESIGN
        // ====================================================

        if (command === "resign") {
            user.job = null;
            user.salary = 0;

            saveUserData(
                guildId,
                userId,
                user
            );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Renuncia",
                        "📤 Has renunciado a tu trabajo."
                    )
                ]
            });
        }

        // ====================================================
        // SALARY
        // ====================================================

        if (command === "salary") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Salario",
                        `💰 Tu salario actual es **${formatMoney(user.salary)}**.`
                    )
                ]
            });
        }

        // ====================================================
        // SHIFT
        // ====================================================

        if (command === "shift") {
            if (!user.job) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "Primero consigue un trabajo con `/apply`."
                        )
                    ]
                });
            }

            const amount =
                user.salary ||
                randomMoney(
                    WORK_MIN,
                    WORK_MAX
                );

            if (!canUseBudget(guildId, amount)) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "El presupuesto del servidor se agotó."
                        )
                    ]
                });
            }

            spendBudget(
                guildId,
                amount
            );

            addMoney(
                guildId,
                userId,
                amount
            );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Turno completado",
                        `💼 Trabajaste como **${user.job}** y ganaste **${formatMoney(amount)}**.`
                    )
                ]
            });
        }

        // ====================================================
        // BONUS
        // ====================================================

        if (command === "bonus") {
            const amount = 50000;

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Bonificación",
                        `🎁 Tu próxima bonificación puede alcanzar **${formatMoney(amount)}**.`
                    )
                ]
            });
        }

        // ====================================================
        // CAREER
        // ====================================================

        if (command === "career") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Carrera",
                        `💼 Trabajo: **${user.job || "Ninguno"}**\n` +
                        `⭐ Nivel: **${user.level}**\n` +
                        `✨ XP: **${user.xp}**`
                    )
                ]
            });
        }

        // ====================================================
        // SKILLS
        // ====================================================

        if (command === "skills") {
            const skills =
                Object.entries(user.skills);

            const text =
                skills.length
                    ? skills.map(
                        ([key, value]) =>
                            `🔹 ${key}: **${value}**`
                    ).join("\n")
                    : "Aún no tienes habilidades.";

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Habilidades",
                        text
                    )
                ]
            });
        }

        // ====================================================
        // MARKET
        // ====================================================

        if (command === "market") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Mercado",
                        "🏪 El mercado está disponible.\n\n" +
                        "Usa `/list` para vender un objeto."
                    )
                ]
            });
        }

        // ====================================================
        // PRICE
        // ====================================================

        if (command === "price") {
            const object =
                interaction.options.getString(
                    "objeto"
                );

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Precio",
                        `🏷️ Precio estimado de **${object}**: **$10,000**`
                    )
                ]
            });
        }

        // ====================================================
        // PROPERTY
        // ====================================================

        if (
            command === "property" ||
            command === "properties"
        ) {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Propiedades",
                        "🏠 Casa básica — $100,000\n" +
                        "🏡 Casa premium — $500,000\n" +
                        "🏰 Mansión — $2,000,000"
                    )
                ]
            });
        }

        // ====================================================
        // MISSIONS
        // ====================================================

        if (
            command === "missions" ||
            command === "mission"
        ) {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Misiones",
                        "🎯 **Primera fortuna**\nConsigue $100,000.\n\n" +
                        "🎯 **Trabajador**\nUsa `/work` 10 veces.\n\n" +
                        "🎯 **Banquero**\nDeposita $50,000."
                    )
                ]
            });
        }

        // ====================================================
        // ACHIEVEMENTS
        // ====================================================

        if (
            command === "achievements" ||
            command === "achievement"
        ) {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Logros",
                        "🏆 Millonario\n" +
                        "🏆 Trabajador\n" +
                        "🏆 Banquero\n" +
                        "🏆 Comerciante"
                    )
                ]
            });
        }

        // ====================================================
        // REWARDS
        // ====================================================

        if (
            command === "rewards" ||
            command === "claim"
        ) {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Recompensas",
                        "🎁 Completa misiones para obtener recompensas."
                    )
                ]
            });
        }

        // ====================================================
        // STREAK
        // ====================================================

        if (command === "streak") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Racha",
                        `🔥 Tu racha actual es de **${user.streak} días**.`
                    )
                ]
            });
        }

        // ====================================================
        // MILESTONES
        // ====================================================

        if (command === "milestones") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Hitos",
                        `💰 Dinero total: **${formatMoney(totalMoney(user))}**\n` +
                        `⭐ Nivel: **${user.level}**`
                    )
                ]
            });
        }

        // ====================================================
        // EVENTOS
        // ====================================================

        if (
            command === "event" ||
            command === "events" ||
            command === "bonusday" ||
            command === "doublemoney"
        ) {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Eventos",
                        "🎁 No hay ningún evento especial activo actualmente."
                    )
                ]
            });
        }

        // ====================================================
        // VIP
        // ====================================================

        if (command === "vip") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "SW VIP",
                        "👑 Beneficios VIP:\n" +
                        "• Daily x2\n" +
                        "• Bonificaciones especiales\n" +
                        "• Recompensas exclusivas"
                    )
                ]
            });
        }

        if (command === "vipshop") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Tienda VIP",
                        "👑 Próximamente podrás configurar los productos VIP del servidor."
                    )
                ]
            });
        }

        if (
            command === "vipbonus" ||
            command === "vipdaily" ||
            command === "vipstats"
        ) {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "VIP",
                        user.vip
                            ? "👑 Tienes acceso a los beneficios VIP."
                            : "❌ No tienes VIP actualmente."
                    )
                ]
            });
        }

        // ====================================================
        // ESTADÍSTICAS
        // ====================================================

        if (
            command === "economy" ||
            command === "economystats"
        ) {
            const allUsers =
                users()[guildId] || {};

            let circulation = 0;

            for (
                const id of Object.keys(allUsers)
            ) {
                circulation +=
                    totalMoney(allUsers[id]);
            }

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Estadísticas económicas",
                        `💰 Circulación: **${formatMoney(circulation)}**\n` +
                        `🏦 Presupuesto: **${formatMoney(config.budget)}**\n` +
                        `👥 Usuarios: **${Object.keys(allUsers).length}**\n` +
                        `💸 Impuestos: **${config.tax}%**`
                    )
                ]
            });
        }

        if (command === "circulation") {
            const allUsers =
                users()[guildId] || {};

            let circulation = 0;

            for (
                const id of Object.keys(allUsers)
            ) {
                circulation +=
                    totalMoney(allUsers[id]);
            }

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Dinero en circulación",
                        `💰 **${formatMoney(circulation)}**`
                    )
                ]
            });
        }

        if (command === "inflation") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Inflación",
                        "📊 La inflación se calcula según el dinero en circulación."
                    )
                ]
            });
        }

        if (
            command === "income" ||
            command === "expenses"
        ) {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        command === "income"
                            ? "Ingresos"
                            : "Gastos",
                        "📊 El historial detallado está disponible mediante `/history`."
                    )
                ]
            });
        }

        if (
            command === "taxes" ||
            command === "tax"
        ) {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Impuestos",
                        `💸 Impuesto actual del servidor: **${config.tax}%**`
                    )
                ]
            });
        }

        // ====================================================
        // LEADERBOARD
        // ====================================================

        if (
            command === "leaderboard" ||
            command === "richest"
        ) {
            const allUsers =
                users()[guildId] || {};

            const ranking =
                Object.entries(allUsers)
                    .sort(
                        (a, b) =>
                            totalMoney(b[1]) -
                            totalMoney(a[1])
                    )
                    .slice(0, 10);

            if (!ranking.length) {
                return interaction.reply({
                    embeds: [
                        economyEmbed(
                            "Ranking",
                            "Todavía no hay usuarios con dinero."
                        )
                    ]
                });
            }

            const text =
                ranking.map(
                    ([id, data], index) =>
                        `**${index + 1}.** <@${id}> — **${formatMoney(totalMoney(data))}**`
                ).join("\n");

            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "🏆 Ranking económico",
                        text
                    )
                ]
            });
        }

        // ====================================================
        // CONFIG
        // ====================================================

        if (command === "config") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "Configuración",
                        `💵 Moneda: **${config.currency}**\n` +
                        `🎨 Emoji: **${config.emoji}**\n` +
                        `💰 Presupuesto: **${formatMoney(config.budget)}**\n` +
                        `💸 Impuesto: **${config.tax}%**\n` +
                        `📢 Canal economía: ${
                            config.economyChannel
                                ? `<#${config.economyChannel}>`
                                : "No configurado"
                        }\n` +
                        `📋 Logs: ${
                            config.logsChannel
                                ? `<#${config.logsChannel}>`
                                : "No configurado"
                        }`
                    )
                ]
            });
        }

        // ====================================================
        // ECO ADMIN
        // ====================================================

        if (command === "eco") {
            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {
                return interaction.reply({
                    embeds: [
                        errorEmbed(
                            "Necesitas permiso de Administrar servidor."
                        )
                    ],
                    ephemeral: true
                });
            }

            const sub =
                interaction.options.getSubcommand();

            if (
                sub === "logs"
            ) {
                const channel =
                    interaction.options.getChannel(
                        "canal"
                    );

                config.logsChannel =
                    channel.id;

                saveGuildData(
                    guildId,
                    config
                );

                return interaction.reply({
                    embeds: [
                        economyEmbed(
                            "Logs configurados",
                            `📋 Canal: ${channel}`
                        )
                    ]
                });
            }

            if (
                sub === "tax"
            ) {
                config.tax =
                    interaction.options.getInteger(
                        "porcentaje"
                    );

                saveGuildData(
                    guildId,
                    config
                );

                return interaction.reply({
                    embeds: [
                        economyEmbed(
                            "Impuestos configurados",
                            `💸 Impuesto: **${config.tax}%**`
                        )
                    ]
                });
            }

            if (
                sub === "reward"
            ) {
                const amount =
                    interaction.options.getInteger(
                        "cantidad"
                    );

                addBudget(
                    guildId,
                    amount
                );

                return interaction.reply({
                    embeds: [
                        economyEmbed(
                            "Presupuesto aumentado",
                            `💰 Se agregaron **${formatMoney(amount)}** al presupuesto.`
                        )
                    ]
                });
            }

            if (
                sub === "ban" ||
                sub === "unban" ||
                sub === "freeze" ||
                sub === "unfreeze"
            ) {
                const target =
                    interaction.options.getUser(
                        "usuario"
                    );

                return interaction.reply({
                    embeds: [
                        economyEmbed(
                            "Sistema administrativo",
                            `🔐 Acción **${sub}** aplicada a ${target}.`
                        )
                    ]
                });
            }

            if (
                sub === "audit"
            ) {
                const data =
                    transactions()
                        .filter(
                            t =>
                                t.guildId ===
                                guildId
                        )
                        .slice(-10);

                const text =
                    data.length
                        ? data.map(
                            t =>
                                `💸 ${formatMoney(t.amount)} • ${t.type}`
                        ).join("\n")
                        : "No hay movimientos.";

                return interaction.reply({
                    embeds: [
                        economyEmbed(
                            "Auditoría",
                            text
                        )
                    ]
                });
            }

            if (
                sub === "maintenance"
            ) {
                const state =
                    interaction.options.getBoolean(
                        "estado"
                    );

                config.maintenance =
                    state;

                saveGuildData(
                    guildId,
                    config
                );

                return interaction.reply({
                    embeds: [
                        economyEmbed(
                            "Mantenimiento",
                            state
                                ? "🔧 Economía activada en modo mantenimiento."
                                : "✅ Mantenimiento desactivado."
                        )
                    ]
                });
            }
        }

        // ====================================================
        // COMANDOS SIN SISTEMA ESPECÍFICO TODAVÍA
        // ====================================================

        const informationalCommands = [
            "auction",
            "bid",
            "list",
            "cancel-sale",
            "trade",
            "offer",
            "accept",
            "decline",
            "buyhouse",
            "sellhouse",
            "rent",
            "upgradehouse",
            "garage",
            "vehicle",
            "buyvehicle",
            "giveaway",
            "raffle",
            "jackpot"
        ];

        if (
            informationalCommands.includes(
                command
            )
        ) {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        command,
                        "🟣 Este módulo está disponible en SW Economy y puede ser configurado desde `/setup`."
                    )
                ]
            });
        }

        // ====================================================
        // HELP
        // ====================================================

        if (command === "help") {
            return interaction.reply({
                embeds: [
                    economyEmbed(
                        "SW Economy • Comandos",
                        "💵 **Dinero:**\n" +
                        "`/balance` `/money` `/wallet` `/bankbalance` `/daily` `/work` `/send`\n\n" +

                        "🏦 **Banco:**\n" +
                        "`/deposit` `/withdraw` `/depositall` `/withdrawall` `/interest` `/history`\n\n" +

                        "💼 **Trabajos:**\n" +
                        "`/jobs` `/job` `/apply` `/resign` `/promote` `/salary` `/shift` `/bonus` `/career` `/skills`\n\n" +

                        "🏪 **Comercio:**\n" +
                        "`/market` `/auction` `/bid` `/list` `/trade` `/offer` `/price`\n\n" +

                        "🏠 **Propiedades:**\n" +
                        "`/property` `/properties` `/buyhouse` `/sellhouse` `/rent` `/upgradehouse` `/garage` `/vehicle` `/buyvehicle`\n\n" +

                        "🎯 **Misiones:**\n" +
                        "`/missions` `/mission` `/claim` `/achievements` `/rewards` `/streak` `/milestones`\n\n" +

                        "🎁 **Eventos:**\n" +
                        "`/event` `/events` `/giveaway` `/raffle` `/jackpot` `/bonusday` `/doublemoney`\n\n" +

                        "👑 **VIP:**\n" +
                        "`/vip` `/vipshop` `/vipbonus` `/vipdaily` `/vipstats`\n\n" +

                        "📊 **Estadísticas:**\n" +
                        "`/economy` `/economystats` `/circulation` `/inflation` `/income` `/expenses` `/taxes` `/tax`\n\n" +

                        "⚙️ **Configuración:**\n" +
                        "`/setup` `/config` `/guía`\n\n" +

                        "🔐 **Administración:**\n" +
                        "`/eco ban` `/eco unban` `/eco freeze` `/eco unfreeze` `/eco audit` `/eco logs` `/eco tax` `/eco reward` `/eco maintenance`"
                    )
                ]
            });
        }

    } catch (error) {
        console.error(
            "❌ Error en interacción:",
            error
        );

        try {
            if (interaction.replied ||
                interaction.deferred) {
                await interaction.followUp({
                    content:
                        "❌ Ocurrió un error ejecutando el comando.",
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content:
                        "❌ Ocurrió un error ejecutando el comando.",
                    ephemeral: true
                });
            }
        } catch {}
    }
});

// ============================================================
// READY
// ============================================================

client.once("ready", async () => {
    console.log("");
    console.log("===============================");
    console.log("🟣 SOCIAL WORLD");
    console.log("===============================");
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

    console.log(
        "✅ SW Economy está completamente iniciado."
    );
});

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
