require("dotenv").config();

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

const express = require("express");
const fs = require("fs");
const path = require("path");

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

// ============================================================
// SERVIDOR WEB PARA RENDER
// ============================================================

const app = express();

app.get("/", (req, res) => {
    res.status(200).send(`
        <html>
            <head>
                <title>SW Economy</title>
            </head>
            <body style="font-family:Arial;text-align:center;padding:50px;">
                <h1>🟣 SW Economy</h1>
                <p>Bot online correctamente.</p>
                <p>Estado: 🟢 ONLINE</p>
            </body>
        </html>
    `);
});

app.get("/health", (req, res) => {
    res.json({
        status: "online",
        bot: client.user ? client.user.tag : null,
        uptime: process.uptime()
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 PORT ${PORT} iniciado correctamente.`);
});

// ============================================================
// CARPETA DATA
// ============================================================

const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================================
// JSON
// ============================================================

function guildFile(guildId) {
    return path.join(DATA_DIR, `guild-${guildId}.json`);
}

function defaultGuild() {
    return {
        currency: "USD",
        symbol: "$",
        emoji: "<:emoji_14:1380789782635872329>",

        budget: 10000000000,

        channels: {
            logs: null,
            economy: null,
            shop: null,
            market: null,
            events: null
        },

        roles: {
            economy: null,
            vip: null
        },

        prefix: "!",

        settings: {
            economy: true,
            daily: true,
            work: true,
            bank: true,
            market: true,
            jobs: true,
            properties: true,
            missions: true,
            vip: true,
            logs: true
        },

        users: {},

        jobs: {
            unemployed: {
                name: "Desempleado",
                salary: 100
            },
            worker: {
                name: "Trabajador",
                salary: 250
            },
            developer: {
                name: "Desarrollador",
                salary: 500
            },
            manager: {
                name: "Gerente",
                salary: 800
            },
            director: {
                name: "Director",
                salary: 1200
            }
        },

        shop: [
            {
                id: "coffee",
                name: "☕ Café",
                price: 100
            },
            {
                id: "phone",
                name: "📱 Teléfono",
                price: 2500
            },
            {
                id: "laptop",
                name: "💻 Laptop",
                price: 5000
            },
            {
                id: "car",
                name: "🚗 Auto",
                price: 25000
            }
        ],

        properties: [
            {
                id: "house",
                name: "🏠 Casa",
                price: 100000
            },
            {
                id: "mansion",
                name: "🏰 Mansión",
                price: 1000000
            }
        ],

        transactions: []
    };
}

function loadGuild(guildId) {
    const file = guildFile(guildId);

    if (!fs.existsSync(file)) {
        const data = defaultGuild();
        saveGuild(guildId, data);
        return data;
    }

    try {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));

        const base = defaultGuild();

        return {
            ...base,
            ...data,
            channels: {
                ...base.channels,
                ...(data.channels || {})
            },
            roles: {
                ...base.roles,
                ...(data.roles || {})
            },
            settings: {
                ...base.settings,
                ...(data.settings || {})
            }
        };
    } catch {
        const data = defaultGuild();
        saveGuild(guildId, data);
        return data;
    }
}

function saveGuild(guildId, data) {
    fs.writeFileSync(
        guildFile(guildId),
        JSON.stringify(data, null, 2)
    );
}

// ============================================================
// USUARIOS
// ============================================================

function getUser(data, userId) {
    if (!data.users[userId]) {
        data.users[userId] = {
            wallet: 0,
            bank: 0,

            xp: 0,
            level: 1,

            job: "unemployed",

            inventory: [],
            properties: [],
            vehicles: [],

            daily: 0,
            weekly: 0,
            monthly: 0,
            work: 0,

            streak: 0,

            income: 0,
            expenses: 0,

            achievements: [],

            createdAt: Date.now()
        };
    }

    return data.users[userId];
}

// ============================================================
// UTILIDADES
// ============================================================

function money(n, data) {
    return `${data.emoji} ${Number(n || 0).toLocaleString("es-CO")} ${data.currency}`;
}

function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addTransaction(data, userId, type, amount, description) {
    data.transactions.push({
        userId,
        type,
        amount,
        description,
        date: Date.now()
    });

    if (data.transactions.length > 1000) {
        data.transactions.shift();
    }
}

function addWallet(data, userId, amount, reason = "Economía") {
    const user = getUser(data, userId);

    user.wallet += amount;

    if (amount > 0) {
        user.income += amount;
    } else {
        user.expenses += Math.abs(amount);
    }

    addTransaction(
        data,
        userId,
        amount >= 0 ? "income" : "expense",
        Math.abs(amount),
        reason
    );
}

function addBank(data, userId, amount) {
    const user = getUser(data, userId);
    user.bank += amount;
}

function totalMoney(user) {
    return user.wallet + user.bank;
}

function cooldown(user, key, time) {
    const now = Date.now();

    if (!user[key]) return false;

    return now - user[key] < time;
}

function remaining(user, key, time) {
    const left = time - (Date.now() - (user[key] || 0));

    if (left <= 0) return "0m";

    const minutes = Math.ceil(left / 60000);

    if (minutes >= 60) {
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    }

    return `${minutes}m`;
}

async function sendLog(guild, data, message) {
    if (!data.settings.logs) return;
    if (!data.channels.logs) return;

    const channel = guild.channels.cache.get(data.channels.logs);

    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle("📋 SW Economy • Registro")
        .setDescription(message)
        .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
}

// ============================================================
// CLIENT
// ============================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Channel
    ]
});

// ============================================================
// COMANDOS
// ============================================================

const commands = [];

// ------------------------------------------------------------
// SETUP
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configura SW Economy")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub =>
            sub
                .setName("eco")
                .setDescription("Abrir configuración de economía")
        )
);

// ------------------------------------------------------------
// GUÍA
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("guía")
        .setDescription("Recibe la guía completa de SW Economy por MD")
);

// ------------------------------------------------------------
// HELP
// ------------------------------------------------------------

commands.push(
    new SlashCommandBuilder()
        .setName("help")
        .setDescription("Ver los comandos de SW Economy")
);

// ============================================================
// COMANDOS ECONÓMICOS
// ============================================================

const simpleCommands = {

    money: "Ver tu dinero total.",
    wallet: "Ver tu cartera.",
    bankbalance: "Ver tu saldo bancario.",

    balance: "Ver tu balance.",
    daily: "Reclamar recompensa diaria.",
    weekly: "Reclamar recompensa semanal.",
    monthly: "Reclamar recompensa mensual.",
    work: "Trabajar y ganar dinero.",

    depositall: "Depositar todo tu dinero.",
    withdrawall: "Retirar todo tu dinero.",
    interest: "Consultar tus intereses.",
    send: "Enviar dinero.",
    request: "Solicitar dinero.",
    split: "Dividir una cantidad entre usuarios.",
    transaction: "Ver una transacción.",
    history: "Ver historial económico.",

    jobs: "Ver trabajos disponibles.",
    job: "Ver tu trabajo.",
    apply: "Solicitar un trabajo.",
    resign: "Renunciar a tu trabajo.",
    promote: "Ascender.",
    salary: "Consultar salario.",
    shift: "Comenzar turno.",
    bonus: "Consultar bonificación.",
    career: "Ver carrera.",
    skills: "Ver habilidades.",

    market: "Ver el mercado.",
    auction: "Ver subastas.",
    bid: "Pujar.",
    list: "Poner un objeto a la venta.",
    "cancel-sale": "Cancelar una venta.",
    trade: "Intercambiar objetos.",
    offer: "Hacer una oferta.",
    accept: "Aceptar intercambio.",
    decline: "Rechazar intercambio.",
    price: "Consultar precio.",

    property: "Ver propiedades.",
    properties: "Ver tus propiedades.",
    buyhouse: "Comprar una propiedad.",
    sellhouse: "Vender una propiedad.",
    rent: "Alquilar una propiedad.",
    upgradehouse: "Mejorar una propiedad.",
    garage: "Ver vehículos.",
    vehicle: "Ver tu vehículo.",
    buyvehicle: "Comprar un vehículo.",

    missions: "Ver misiones.",
    mission: "Ver misión actual.",
    claim: "Reclamar recompensa.",
    achievements: "Ver logros.",
    achievement: "Ver detalles de un logro.",
    rewards: "Ver recompensas.",
    streak: "Ver tu racha.",
    milestones: "Ver hitos.",

    event: "Ver evento activo.",
    events: "Ver eventos.",
    giveaway: "Ver sorteos.",
    raffle: "Ver rifas.",
    jackpot: "Ver premio acumulado.",
    bonusday: "Ver bonificación del día.",
    doublemoney: "Ver evento de dinero x2.",

    vip: "Ver información VIP.",
    vipshop: "Ver tienda VIP.",
    vipbonus: "Ver bono VIP.",
    vipdaily: "Recompensa diaria VIP.",
    vipstats: "Estadísticas VIP.",

    economy: "Estadísticas generales.",
    economystats: "Estadísticas del servidor.",
    circulation: "Dinero en circulación.",
    inflation: "Estado económico.",
    income: "Ver tus ingresos.",
    expenses: "Ver tus gastos.",
    taxes: "Ver impuestos.",
    tax: "Consultar impuestos.",

    leaderboard: "Ranking económico.",
    richest: "Usuarios más ricos.",
    topdaily: "Ranking diario.",
    topweekly: "Ranking semanal.",
    topwork: "Ranking de trabajo."
};

for (const [name, description] of Object.entries(simpleCommands)) {
    commands.push(
        new SlashCommandBuilder()
            .setName(name)
            .setDescription(description)
    );
}

// ============================================================
// COMANDOS CON OPCIONES
// ============================================================

commands.push(
    new SlashCommandBuilder()
        .setName("pay")
        .setDescription("Enviar dinero a otro usuario")
        .addUserOption(o =>
            o.setName("usuario")
                .setDescription("Usuario")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("cantidad")
                .setDescription("Cantidad")
                .setMinValue(1)
                .setRequired(true)
        )
);

commands.push(
    new SlashCommandBuilder()
        .setName("deposit")
        .setDescription("Depositar dinero")
        .addIntegerOption(o =>
            o.setName("cantidad")
                .setDescription("Cantidad")
                .setMinValue(1)
                .setRequired(true)
        )
);

commands.push(
    new SlashCommandBuilder()
        .setName("withdraw")
        .setDescription("Retirar dinero")
        .addIntegerOption(o =>
            o.setName("cantidad")
                .setDescription("Cantidad")
                .setMinValue(1)
                .setRequired(true)
        )
);

commands.push(
    new SlashCommandBuilder()
        .setName("buy")
        .setDescription("Comprar un artículo")
        .addStringOption(o =>
            o.setName("item")
                .setDescription("ID del artículo")
                .setRequired(true)
        )
);

commands.push(
    new SlashCommandBuilder()
        .setName("sell")
        .setDescription("Vender un artículo")
        .addStringOption(o =>
            o.setName("item")
                .setDescription("ID del artículo")
                .setRequired(true)
        )
);

commands.push(
    new SlashCommandBuilder()
        .setName("inventory")
        .setDescription("Ver tu inventario")
);

commands.push(
    new SlashCommandBuilder()
        .setName("shop")
        .setDescription("Ver la tienda")
);

commands.push(
    new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("Ver ranking económico")
);

commands.push(
    new SlashCommandBuilder()
        .setName("profile")
        .setDescription("Ver tu perfil económico")
);

// ============================================================
// ADMIN ECO
// ============================================================

const adminEco = [
    ["ban", "Bloquear economía a un usuario."],
    ["unban", "Desbloquear economía."],
    ["freeze", "Congelar saldo."],
    ["unfreeze", "Descongelar saldo."],
    ["audit", "Revisar movimientos."],
    ["logs", "Configurar registros."],
    ["tax", "Configurar impuestos."],
    ["reward", "Configurar recompensas."],
    ["jobs", "Administrar trabajos."],
    ["shop", "Administrar tienda."],
    ["market", "Administrar mercado."],
    ["event", "Crear eventos."],
    ["maintenance", "Activar mantenimiento."],
    ["give", "Dar dinero."],
    ["remove", "Retirar dinero."],
    ["set", "Establecer saldo."],
    ["reset", "Reiniciar economía."]
];

const ecoCommand = new SlashCommandBuilder()
    .setName("eco")
    .setDescription("Administración avanzada de SW Economy")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

for (const [name, description] of adminEco) {
    ecoCommand.addSubcommand(sub => {
        sub.setName(name).setDescription(description);

        if (
            ["ban", "unban", "freeze", "unfreeze",
             "give", "remove", "set", "reset"].includes(name)
        ) {
            sub.addUserOption(o =>
                o.setName("usuario")
                    .setDescription("Usuario")
                    .setRequired(true)
            );
        }

        if (["give", "remove", "set"].includes(name)) {
            sub.addIntegerOption(o =>
                o.setName("cantidad")
                    .setDescription("Cantidad")
                    .setMinValue(0)
                    .setRequired(true)
            );
        }

        return sub;
    });

commands.push(ecoCommand);

// ============================================================
// REGISTRO GLOBAL
// ============================================================

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    try {
        console.log("🌎 Registrando comandos globales...");

        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            {
                body: commands.map(c => c.toJSON())
            }
        );

        console.log(`✅ ${commands.length} comandos registrados.`);
    } catch (error) {
        console.error("❌ Error registrando comandos:", error);
    }
}

// ============================================================
// READY
// ============================================================

client.once("ready", async () => {
    console.log("");
    console.log("===============================");
    console.log("🟣 SOCIAL WORLD");
    console.log("===============================");
    console.log(`🤖 Bot: ${client.user.tag}`);
    console.log(`🌎 Servidores: ${client.guilds.cache.size}`);

    await registerCommands();
});

// ============================================================
// SETUP ECO — PANEL
// ============================================================

const setupSessions = new Map();

function setupEmbed(guild, data, step) {

    const steps = [
        "💰 Moneda",
        "📢 Canales",
        "🎭 Roles",
        "⚙️ Comandos",
        "💵 Presupuesto",
        "📋 Logs"
    ];

    return new EmbedBuilder()
        .setColor(0x7c3aed)
        .setAuthor({
            name: "SW Economy • Configuración"
        })
        .setTitle(`⚙️ Configuración de Economía • Paso ${step}/6`)
        .setDescription(
            `Configura la economía de **${guild.name}** desde este panel.\n\n` +
            steps.map((x, i) =>
                `${i + 1 === step ? "🔵" : "⚪"} **${i + 1}.** ${x}`
            ).join("\n")
        )
        .addFields({
            name: "💰 Configuración actual",
            value:
                `Moneda: **${data.currency}**\n` +
                `Símbolo: **${data.symbol}**\n` +
                `Emoji: ${data.emoji}\n` +
                `Presupuesto: **${money(data.budget, data)}**`
        })
        .setFooter({
            text: "SW Economy • Configuración por servidor"
        });
}

function setupButtons(step) {

    const row = new ActionRowBuilder();

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`eco_prev_${step}`)
            .setLabel("Atrás")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(step <= 1),

        new ButtonBuilder()
            .setCustomId(`eco_next_${step}`)
            .setLabel(step >= 6 ? "Finalizar" : "Siguiente")
            .setEmoji(step >= 6 ? "✅" : "▶️")
            .setStyle(step >= 6 ? ButtonStyle.Success : ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("eco_close")
            .setLabel("Cerrar")
            .setEmoji("✕")
            .setStyle(ButtonStyle.Danger)
    );

    return row;
}

async function showSetup(interaction, step) {

    const data = loadGuild(interaction.guild.id);

    setupSessions.set(interaction.user.id, {
        guildId: interaction.guild.id,
        step
    });

    const embed = setupEmbed(
        interaction.guild,
        data,
        step
    );

    const components = [];

    // --------------------------------------------------------
    // PASO 1
    // --------------------------------------------------------

    if (step === 1) {

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("eco_currency")
                    .setPlaceholder("💰 Selecciona la moneda")
                    .addOptions(
                        {
                            label: "USD",
                            value: "USD",
                            emoji: "💵"
                        },
                        {
                            label: "COP",
                            value: "COP",
                            emoji: "🇨🇴"
                        },
                        {
                            label: "EUR",
                            value: "EUR",
                            emoji: "💶"
                        },
                        {
                            label: "MXN",
                            value: "MXN",
                            emoji: "🇲🇽"
                        }
                    )
            );

        components.push(row);

        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("eco_symbol")
                        .setLabel("Cambiar símbolo")
                        .setEmoji("💲")
                        .setStyle(ButtonStyle.Primary),

                    new ButtonBuilder()
                        .setCustomId("eco_emoji")
                        .setLabel("Cambiar emoji")
                        .setEmoji("😀")
                        .setStyle(ButtonStyle.Secondary)
                )
        );
    }

    // --------------------------------------------------------
    // PASO 2
    // --------------------------------------------------------

    if (step === 2) {

        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId("eco_channel")
                        .setPlaceholder("🔎 Busca y selecciona un canal")
                        .setChannelTypes(0)
                )
        );
    }

    // --------------------------------------------------------
    // PASO 3
    // --------------------------------------------------------

    if (step === 3) {

        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new RoleSelectMenuBuilder()
                        .setCustomId("eco_role")
                        .setPlaceholder("🔎 Busca y selecciona un rol")
                        .setMinValues(1)
                        .setMaxValues(1)
                )
        );
    }

    // --------------------------------------------------------
    // PASO 4
    // --------------------------------------------------------

    if (step === 4) {

        const menu = new StringSelectMenuBuilder()
            .setCustomId("eco_toggle")
            .setPlaceholder("⚙️ Selecciona una función")
            .setMinValues(1)
            .setMaxValues(9)
            .addOptions(
                {
                    label: "Economía",
                    value: "economy",
                    emoji: "💰"
                },
                {
                    label: "Daily",
                    value: "daily",
                    emoji: "🎁"
                },
                {
                    label: "Work",
                    value: "work",
                    emoji: "💼"
                },
                {
                    label: "Banco",
                    value: "bank",
                    emoji: "🏦"
                },
                {
                    label: "Mercado",
                    value: "market",
                    emoji: "🏪"
                },
                {
                    label: "Trabajos",
                    value: "jobs",
                    emoji: "💼"
                },
                {
                    label: "Propiedades",
                    value: "properties",
                    emoji: "🏠"
                },
                {
                    label: "Misiones",
                    value: "missions",
                    emoji: "🎯"
                },
                {
                    label: "VIP",
                    value: "vip",
                    emoji: "👑"
                }
            );

        components.push(
            new ActionRowBuilder().addComponents(menu)
        );
    }

    // --------------------------------------------------------
    // PASO 5
    // --------------------------------------------------------

    if (step === 5) {

        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("eco_budget")
                        .setLabel("Configurar presupuesto")
                        .setEmoji("💵")
                        .setStyle(ButtonStyle.Primary)
                )
        );
    }

    // --------------------------------------------------------
    // PASO 6
    // --------------------------------------------------------

    if (step === 6) {

        components.push(
            new ActionRowBuilder()
                .addComponents(
                    new ChannelSelectMenuBuilder()
                        .setCustomId("eco_logs")
                        .setPlaceholder("📋 Selecciona el canal de logs")
                        .setChannelTypes(0)
                )
        );
    }

    components.push(setupButtons(step));

    await interaction.editReply({
        embeds: [embed],
        components
    });
}

// ============================================================
// GUÍA
// ============================================================

async function sendGuide(interaction) {

    const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setAuthor({
            name: "SW Economy"
        })
        .setTitle("📖 Guía Oficial de SW Economy")
        .setDescription(
            "Bienvenido a **SW Economy**.\n\n" +
            "Sistema de economía global para Discord con dinero, " +
            "trabajos, comercio, propiedades, misiones, eventos, VIP " +
            "y estadísticas."
        )
        .addFields(
            {
                name: "💵 Dinero y banco",
                value:
                    "`/money` `/wallet` `/bankbalance`\n" +
                    "`/balance` `/daily` `/weekly` `/monthly`\n" +
                    "`/deposit` `/withdraw` `/depositall` `/withdrawall`\n" +
                    "`/pay` `/send` `/request` `/history`"
            },
            {
                name: "💼 Trabajos",
                value:
                    "`/jobs` `/job` `/apply` `/resign`\n" +
                    "`/promote` `/salary` `/shift` `/bonus`\n" +
                    "`/career` `/skills`"
            },
            {
                name: "🏪 Comercio",
                value:
                    "`/shop` `/buy` `/sell` `/inventory`\n" +
                    "`/market` `/auction` `/bid` `/trade`\n" +
                    "`/offer` `/accept` `/decline` `/price`"
            },
            {
                name: "🏠 Propiedades",
                value:
                    "`/property` `/properties` `/buyhouse`\n" +
                    "`/sellhouse` `/rent` `/upgradehouse`\n" +
                    "`/garage` `/vehicle` `/buyvehicle`"
            },
            {
                name: "🎯 Misiones",
                value:
                    "`/missions` `/mission` `/claim`\n" +
                    "`/achievements` `/achievement` `/rewards`\n" +
                    "`/streak` `/milestones`"
            },
            {
                name: "🎁 Eventos",
                value:
                    "`/event` `/events` `/giveaway`\n" +
                    "`/raffle` `/jackpot` `/bonusday` `/doublemoney`"
            },
            {
                name: "👑 VIP",
                value:
                    "`/vip` `/vipshop` `/vipbonus`\n" +
                    "`/vipdaily` `/vipstats`"
            },
            {
                name: "📊 Estadísticas",
                value:
                    "`/economy` `/economystats` `/circulation`\n" +
                    "`/inflation` `/income` `/expenses`\n" +
                    "`/taxes` `/tax` `/leaderboard` `/richest`"
            },
            {
                name: "⚙️ Administración",
                value:
                    "`/setup eco` — Configuración completa\n" +
                    "`/eco` — Administración avanzada"
            }
        )
        .setFooter({
            text: "SW Economy • Usa /help para ver los comandos"
        })
        .setTimestamp();

    try {
        await interaction.user.send({
            embeds: [embed]
        });

        await interaction.reply({
            content: "📖 ¡Listo! Te envié la guía completa por MD. 💜",
            ephemeral: true
        });
    } catch {
        await interaction.reply({
            content:
                "❌ No pude enviarte la guía por MD. " +
                "Activa los mensajes directos para miembros del servidor.",
            ephemeral: true
        });
    }
}

// ============================================================
// HELP
// ============================================================

async function showHelp(interaction) {

    const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle("🟣 SW Economy • Centro de comandos")
        .setDescription(
            "Selecciona una categoría para consultar los comandos."
        );

    const menu = new StringSelectMenuBuilder()
        .setCustomId("help_category")
        .setPlaceholder("📚 Selecciona una categoría")
        .addOptions(
            {
                label: "Economía",
                value: "economy",
                emoji: "💵"
            },
            {
                label: "Trabajos",
                value: "jobs",
                emoji: "💼"
            },
            {
                label: "Comercio",
                value: "commerce",
                emoji: "🏪"
            },
            {
                label: "Propiedades",
                value: "properties",
                emoji: "🏠"
            },
            {
                label: "Misiones",
                value: "missions",
                emoji: "🎯"
            },
            {
                label: "Eventos",
                value: "events",
                emoji: "🎁"
            },
            {
                label: "VIP",
                value: "vip",
                emoji: "👑"
            },
            {
                label: "Estadísticas",
                value: "stats",
                emoji: "📊"
            },
            {
                label: "Administración",
                value: "admin",
                emoji: "🔐"
            }
        );

    await interaction.reply({
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(menu)
        ],
        ephemeral: true
    });
}

// ============================================================
// INTERACCIONES
// ============================================================

client.on("interactionCreate", async interaction => {

    try {

        // ====================================================
        // SLASH COMMAND
        // ====================================================

        if (interaction.isChatInputCommand()) {

            const command = interaction.commandName;
            const guild = interaction.guild;

            if (!guild) {
                return interaction.reply({
                    content: "❌ Este comando solo funciona en servidores.",
                    ephemeral: true
                });
            }

            const data = loadGuild(guild.id);
            const user = getUser(data, interaction.user.id);

            // ------------------------------------------------
            // SETUP
            // ------------------------------------------------

            if (command === "setup") {

                if (
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.ManageGuild
                    )
                ) {
                    return interaction.reply({
                        content: "❌ Necesitas **Administrar servidor**.",
                        ephemeral: true
                    });
                }

                await interaction.deferReply({
                    ephemeral: true
                });

                await showSetup(interaction, 1);
                return;
            }

            // ------------------------------------------------
            // GUÍA
            // ------------------------------------------------

            if (command === "guía") {
                await sendGuide(interaction);
                return;
            }

            // ------------------------------------------------
            // HELP
            // ------------------------------------------------

            if (command === "help") {
                await showHelp(interaction);
                return;
            }

            // ------------------------------------------------
            // BALANCE
            // ------------------------------------------------

            if (
                ["balance", "money", "wallet", "bankbalance"].includes(command)
            ) {

                const embed = new EmbedBuilder()
                    .setColor(0x7c3aed)
                    .setTitle(`💰 Economía de ${interaction.user.username}`)
                    .setThumbnail(
                        interaction.user.displayAvatarURL()
                    )
                    .addFields(
                        {
                            name: "💵 Cartera",
                            value: money(user.wallet, data),
                            inline: true
                        },
                        {
                            name: "🏦 Banco",
                            value: money(user.bank, data),
                            inline: true
                        },
                        {
                            name: "💎 Total",
                            value: money(totalMoney(user), data),
                            inline: true
                        }
                    )
                    .setFooter({
                        text: `SW Economy • ${guild.name}`
                    });

                await interaction.reply({
                    embeds: [embed]
                });

                return;
            }

            // ------------------------------------------------
            // DAILY
            // ------------------------------------------------

            if (command === "daily") {

                if (cooldown(user, "daily", 86400000)) {
                    return interaction.reply({
                        content:
                            `⏳ Ya reclamaste tu daily. ` +
                            `Disponible en **${remaining(user, "daily", 86400000)}**.`,
                        ephemeral: true
                    });
                }

                const reward = random(500, 1500);

                user.daily = Date.now();
                user.streak++;

                addWallet(
                    data,
                    interaction.user.id,
                    reward,
                    "Recompensa diaria"
                );

                saveGuild(guild.id, data);

                await interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x22c55e)
                            .setTitle("🎁 Daily reclamado")
                            .setDescription(
                                `Recibiste **${money(reward, data)}**.\n\n` +
                                `🔥 Racha: **${user.streak} días**`
                            )
                    ]
                });

                await sendLog(
                    guild,
                    data,
                    `💰 <@${interaction.user.id}> recibió ${money(reward, data)} por daily.`
                );

                return;
            }

            // ------------------------------------------------
            // WEEKLY
            // ------------------------------------------------

            if (command === "weekly") {

                if (cooldown(user, "weekly", 604800000)) {
                    return interaction.reply({
                        content:
                            `⏳ Disponible en **${remaining(user, "weekly", 604800000)}**.`,
                        ephemeral: true
                    });
                }

                const reward = random(5000, 15000);

                user.weekly = Date.now();

                addWallet(
                    data,
                    interaction.user.id,
                    reward,
                    "Recompensa semanal"
                );

                saveGuild(guild.id, data);

                return interaction.reply({
                    content:
                        `🎁 Recibiste **${money(reward, data)}** por tu recompensa semanal.`
                });
            }

            // ------------------------------------------------
            // MONTHLY
            // ------------------------------------------------

            if (command === "monthly") {

                if (cooldown(user, "monthly", 2592000000)) {
                    return interaction.reply({
                        content:
                            `⏳ Tu recompensa mensual estará disponible en ` +
                            `**${remaining(user, "monthly", 2592000000)}**.`,
                        ephemeral: true
                    });
                }

                const reward = random(25000, 75000);

                user.monthly = Date.now();

                addWallet(
                    data,
                    interaction.user.id,
                    reward,
                    "Recompensa mensual"
                );

                saveGuild(guild.id, data);

                return interaction.reply({
                    content:
                        `🎁 Recibiste **${money(reward, data)}** por tu recompensa mensual.`
                });
            }

            // ------------------------------------------------
            // WORK
            // ------------------------------------------------

            if (command === "work") {

                if (cooldown(user, "work", 3600000)) {
                    return interaction.reply({
                        content:
                            `⏳ Ya trabajaste. Puedes volver en ` +
                            `**${remaining(user, "work", 3600000)}**.`,
                        ephemeral: true
                    });
                }

                const job = data.jobs[user.job] || data.jobs.unemployed;

                const reward = random(
                    Math.floor(job.salary * 0.7),
                    Math.floor(job.salary * 1.4)
                );

                user.work = Date.now();

                addWallet(
                    data,
                    interaction.user.id,
                    reward,
                    `Trabajo: ${job.name}`
                );

                user.xp += random(5, 20);

                if (user.xp >= user.level * 100) {
                    user.xp = 0;
                    user.level++;
                }

                saveGuild(guild.id, data);

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x22c55e)
                            .setTitle("💼 Trabajo completado")
                            .setDescription(
                                `Trabajaste como **${job.name}**.\n\n` +
                                `💵 Ganaste: **${money(reward, data)}**\n` +
                                `⭐ Nivel: **${user.level}**`
                            )
                    ]
                });
            }

            // ------------------------------------------------
            // PAY
            // ------------------------------------------------

            if (command === "pay") {

                const target =
                    interaction.options.getUser("usuario");

                const amount =
                    interaction.options.getInteger("cantidad");

                if (target.id === interaction.user.id) {
                    return interaction.reply({
                        content: "❌ No puedes enviarte dinero a ti mismo.",
                        ephemeral: true
                    });
                }

                const targetUser = getUser(data, target.id);

                if (user.wallet < amount) {
                    return interaction.reply({
                        content: "❌ No tienes suficiente dinero.",
                        ephemeral: true
                    });
                }

                user.wallet -= amount;
                targetUser.wallet += amount;

                user.expenses += amount;
                targetUser.income += amount;

                addTransaction(
                    data,
                    interaction.user.id,
                    "transfer",
                    amount,
                    `Enviado a ${target.tag}`
                );

                addTransaction(
                    data,
                    target.id,
                    "transfer",
                    amount,
                    `Recibido de ${interaction.user.tag}`
                );

                saveGuild(guild.id, data);

                await interaction.reply({
                    content:
                        `💸 <@${interaction.user.id}> envió ` +
                        `**${money(amount, data)}** a <@${target.id}>.`
                });

                await sendLog(
                    guild,
                    data,
                    `💸 <@${interaction.user.id}> → <@${target.id}>: ${money(amount, data)}`
                );

                return;
            }

            // ------------------------------------------------
            // DEPOSIT
            // ------------------------------------------------

            if (command === "deposit") {

                const amount =
                    interaction.options.getInteger("cantidad");

                if (user.wallet < amount) {
                    return interaction.reply({
                        content: "❌ No tienes suficiente dinero en tu cartera.",
                        ephemeral: true
                    });
                }

                user.wallet -= amount;
                user.bank += amount;

                saveGuild(guild.id, data);

                return interaction.reply({
                    content:
                        `🏦 Depositaste **${money(amount, data)}**.`
                });
            }

            // ------------------------------------------------
            // WITHDRAW
            // ------------------------------------------------

            if (command === "withdraw") {

                const amount =
                    interaction.options.getInteger("cantidad");

                if (user.bank < amount) {
                    return interaction.reply({
                        content: "❌ No tienes suficiente dinero en el banco.",
                        ephemeral: true
                    });
                }

                user.bank -= amount;
                user.wallet += amount;

                saveGuild(guild.id, data);

                return interaction.reply({
                    content:
                        `🏦 Retiraste **${money(amount, data)}**.`
                });
            }

            // ------------------------------------------------
            // DEPOSIT ALL
            // ------------------------------------------------

            if (command === "depositall") {

                if (user.wallet <= 0) {
                    return interaction.reply({
                        content: "❌ No tienes dinero en la cartera.",
                        ephemeral: true
                    });
                }

                const amount = user.wallet;

                user.wallet = 0;
                user.bank += amount;

                saveGuild(guild.id, data);

                return interaction.reply({
                    content:
                        `🏦 Depositaste todo: **${money(amount, data)}**.`
                });
            }

            // ------------------------------------------------
            // WITHDRAW ALL
            // ------------------------------------------------

            if (command === "withdrawall") {

                if (user.bank <= 0) {
                    return interaction.reply({
                        content: "❌ No tienes dinero en el banco.",
                        ephemeral: true
                    });
                }

                const amount = user.bank;

                user.bank = 0;
                user.wallet += amount;

                saveGuild(guild.id, data);

                return interaction.reply({
                    content:
                        `🏦 Retiraste todo: **${money(amount, data)}**.`
                });
            }

            // ------------------------------------------------
            // SHOP
            // ------------------------------------------------

            if (command === "shop") {

                const embed = new EmbedBuilder()
                    .setColor(0x7c3aed)
                    .setTitle("🏪 SW Economy • Tienda")
                    .setDescription(
                        data.shop.map(item =>
                            `**${item.name}**\n` +
                            `ID: \`${item.id}\`\n` +
                            `💰 ${money(item.price, data)}`
                        ).join("\n\n")
                    );

                return interaction.reply({
                    embeds: [embed]
                });
            }

            // ------------------------------------------------
            // BUY
            // ------------------------------------------------

            if (command === "buy") {

                const id =
                    interaction.options.getString("item")
                        .toLowerCase();

                const item = data.shop.find(
                    x => x.id.toLowerCase() === id
                );

                if (!item) {
                    return interaction.reply({
                        content: "❌ Ese artículo no existe.",
                        ephemeral: true
                    });
                }

                if (user.wallet < item.price) {
                    return interaction.reply({
                        content: "❌ No tienes suficiente dinero.",
                        ephemeral: true
                    });
                }

                user.wallet -= item.price;
                user.expenses += item.price;
                user.inventory.push(item.id);

                saveGuild(guild.id, data);

                return interaction.reply({
                    content:
                        `🛒 Compraste **${item.name}** por ` +
                        `**${money(item.price, data)}**.`
                });
            }

            // ------------------------------------------------
            // SELL
            // ------------------------------------------------

            if (command === "sell") {

                const id =
                    interaction.options.getString("item")
                        .toLowerCase();

                const index = user.inventory.indexOf(id);

                if (index === -1) {
                    return interaction.reply({
                        content: "❌ No tienes ese artículo.",
                        ephemeral: true
                    });
                }

                const item = data.shop.find(
                    x => x.id === id
                );

                if (!item) {
                    return interaction.reply({
                        content: "❌ Ese artículo ya no existe.",
                        ephemeral: true
                    });
                }

                const value = Math.floor(item.price * 0.7);

                user.inventory.splice(index, 1);

                addWallet(
                    data,
                    interaction.user.id,
                    value,
                    `Venta: ${item.name}`
                );

                saveGuild(guild.id, data);

                return interaction.reply({
                    content:
                        `💵 Vendiste **${item.name}** por ` +
                        `**${money(value, data)}**.`
                });
            }

            // ------------------------------------------------
            // INVENTORY
            // ------------------------------------------------

            if (command === "inventory") {

                if (!user.inventory.length) {
                    return interaction.reply({
                        content: "🎒 Tu inventario está vacío."
                    });
                }

                const count = {};

                for (const id of user.inventory) {
                    count[id] = (count[id] || 0) + 1;
                }

                const text = Object.entries(count)
                    .map(([id, amount]) => {
                        const item = data.shop.find(
                            x => x.id === id
                        );

                        return `• ${item ? item.name : id} ×${amount}`;
                    })
                    .join("\n");

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x7c3aed)
                            .setTitle("🎒 Tu inventario")
                            .setDescription(text)
                    ]
                });
            }

            // ------------------------------------------------
            // LEADERBOARD
            // ------------------------------------------------

            if (
                command === "leaderboard" ||
                command === "richest" ||
                command === "economystats"
            ) {

                const ranking = Object.entries(data.users)
                    .map(([id, u]) => ({
                        id,
                        total: totalMoney(u)
                    }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 10);

                if (!ranking.length) {
                    return interaction.reply({
                        content: "📊 Todavía no hay datos económicos."
                    });
                }

                const text = ranking.map((x, i) =>
                    `**${i + 1}.** <@${x.id}> — **${money(x.total, data)}**`
                ).join("\n");

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x7c3aed)
                            .setTitle("🏆 SW Economy • Ranking")
                            .setDescription(text)
                    ]
                });
            }

            // ------------------------------------------------
            // PROFILE
            // ------------------------------------------------

            if (command === "profile") {

                const job =
                    data.jobs[user.job] ||
                    data.jobs.unemployed;

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x7c3aed)
                            .setTitle(`👤 Perfil de ${interaction.user.username}`)
                            .setThumbnail(
                                interaction.user.displayAvatarURL()
                            )
                            .addFields(
                                {
                                    name: "💰 Patrimonio",
                                    value: money(totalMoney(user), data),
                                    inline: true
                                },
                                {
                                    name: "💼 Trabajo",
                                    value: job.name,
                                    inline: true
                                },
                                {
                                    name: "⭐ Nivel",
                                    value: `${user.level}`,
                                    inline: true
                                },
                                {
                                    name: "🔥 Racha",
                                    value: `${user.streak}`,
                                    inline: true
                                },
                                {
                                    name: "🎒 Inventario",
                                    value: `${user.inventory.length}`,
                                    inline: true
                                },
                                {
                                    name: "🏠 Propiedades",
                                    value: `${user.properties.length}`,
                                    inline: true
                                }
                            )
                    ]
                });
            }

            // ------------------------------------------------
            // JOBS
            // ------------------------------------------------

            if (command === "jobs") {

                const text = Object.entries(data.jobs)
                    .map(([id, job]) =>
                        `**${job.name}** — ID: \`${id}\` — ` +
                        `${money(job.salary, data)}/trabajo`
                    )
                    .join("\n");

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x7c3aed)
                            .setTitle("💼 Trabajos disponibles")
                            .setDescription(text)
                    ]
                });
            }

            // ------------------------------------------------
            // JOB
            // ------------------------------------------------

            if (command === "job") {

                const job =
                    data.jobs[user.job] ||
                    data.jobs.unemployed;

                return interaction.reply({
                    content:
                        `💼 Tu trabajo actual es **${job.name}**.\n` +
                        `💰 Salario base: **${money(job.salary, data)}**`
                });
            }

            // ------------------------------------------------
            // APPLY
            // ------------------------------------------------

            if (command === "apply") {

                const jobs = Object.entries(data.jobs)
                    .filter(([id]) => id !== "unemployed");

                const selected =
                    jobs[random(0, jobs.length - 1)];

                user.job = selected[0];

                saveGuild(guild.id, data);

                return interaction.reply({
                    content:
                        `💼 Fuiste contratado como **${selected[1].name}**.`
                });
            }

            // ------------------------------------------------
            // RESIGN
            // ------------------------------------------------

            if (command === "resign") {

                user.job = "unemployed";

                saveGuild(guild.id, data);

                return interaction.reply({
                    content:
                        "📄 Has renunciado a tu trabajo."
                });
            }

            // ------------------------------------------------
            // SALARY
            // ------------------------------------------------

            if (command === "salary") {

                const job =
                    data.jobs[user.job] ||
                    data.jobs.unemployed;

                return interaction.reply({
                    content:
                        `💼 Salario de **${job.name}**: ` +
                        `**${money(job.salary, data)}**`
                });
            }

            // ------------------------------------------------
            // INCOME
            // ------------------------------------------------

            if (command === "income") {

                return interaction.reply({
                    content:
                        `📈 Tus ingresos registrados son ` +
                        `**${money(user.income, data)}**.`
                });
            }

            // ------------------------------------------------
            // EXPENSES
            // ------------------------------------------------

            if (command === "expenses") {

                return interaction.reply({
                    content:
                        `📉 Tus gastos registrados son ` +
                        `**${money(user.expenses, data)}**.`
                });
            }

            // ------------------------------------------------
            // HISTORY
            // ------------------------------------------------

            if (command === "history") {

                const transactions =
                    data.transactions
                        .filter(x =>
                            x.userId === interaction.user.id
                        )
                        .slice(-10)
                        .reverse();

                if (!transactions.length) {
                    return interaction.reply({
                        content: "📋 No tienes transacciones registradas."
                    });
                }

                const text = transactions.map(x =>
                    `• **${x.description}** — ` +
                    `${money(x.amount, data)}`
                ).join("\n");

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x7c3aed)
                            .setTitle("📋 Historial económico")
                            .setDescription(text)
                    ]
                });
            }

            // ------------------------------------------------
            // GENERALES
            // ------------------------------------------------

            if (
                [
                    "interest",
                    "request",
                    "split",
                    "transaction",
                    "market",
                    "auction",
                    "bid",
                    "list",
                    "cancel-sale",
                    "trade",
                    "offer",
                    "accept",
                    "decline",
                    "price",
                    "property",
                    "properties",
                    "buyhouse",
                    "sellhouse",
                    "rent",
                    "upgradehouse",
                    "garage",
                    "vehicle",
                    "buyvehicle",
                    "missions",
                    "mission",
                    "claim",
                    "achievements",
                    "achievement",
                    "rewards",
                    "streak",
                    "milestones",
                    "event",
                    "events",
                    "giveaway",
                    "raffle",
                    "jackpot",
                    "bonusday",
                    "doublemoney",
                    "vip",
                    "vipshop",
                    "vipbonus",
                    "vipdaily",
                    "vipstats",
                    "economy",
                    "circulation",
                    "inflation",
                    "taxes",
                    "tax",
                    "topdaily",
                    "topweekly",
                    "topwork",
                    "promote",
                    "bonus",
                    "shift",
                    "career",
                    "skills"
                ].includes(command)
            ) {

                return interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x7c3aed)
                            .setTitle(`🟣 SW Economy • /${command}`)
                            .setDescription(
                                `El sistema **/${command}** está disponible en SW Economy.\n\n` +
                                `⚙️ Este módulo utiliza la configuración de **/setup eco** de este servidor.`
                            )
                    ]
                });
            }

            // ------------------------------------------------
            // ECO ADMIN
            // ------------------------------------------------

            if (command === "eco") {

                if (
                    !interaction.member.permissions.has(
                        PermissionFlagsBits.ManageGuild
                    )
                ) {
                    return interaction.reply({
                        content:
                            "❌ Necesitas **Administrar servidor**.",
                        ephemeral: true
                    });
                }

                const sub =
                    interaction.options.getSubcommand();

                if (sub === "give") {

                    const target =
                        interaction.options.getUser("usuario");

                    const amount =
                        interaction.options.getInteger("cantidad");

                    const targetData =
                        getUser(data, target.id);

                    addWallet(
                        data,
                        target.id,
                        amount,
                        "Administración"
                    );

                    saveGuild(guild.id, data);

                    return interaction.reply({
                        content:
                            `💰 Se añadieron **${money(amount, data)}** a <@${target.id}>.`
                    });
                }

                if (sub === "remove") {

                    const target =
                        interaction.options.getUser("usuario");

                    const amount =
                        interaction.options.getInteger("cantidad");

                    const targetData =
                        getUser(data, target.id);

                    targetData.wallet =
                        Math.max(0, targetData.wallet - amount);

                    saveGuild(guild.id, data);

                    return interaction.reply({
                        content:
                            `💸 Se retiraron **${money(amount, data)}** de <@${target.id}>.`
                    });
                }

                if (sub === "set") {

                    const target =
                        interaction.options.getUser("usuario");

                    const amount =
                        interaction.options.getInteger("cantidad");

                    const targetData =
                        getUser(data, target.id);

                    targetData.wallet = amount;

                    saveGuild(guild.id, data);

                    return interaction.reply({
                        content:
                            `⚙️ El saldo de <@${target.id}> ahora es ` +
                            `**${money(amount, data)}**.`
                    });
                }

                if (sub === "reset") {

                    const target =
                        interaction.options.getUser("usuario");

                    data.users[target.id] = {
                        ...getUser(defaultGuild(), target.id)
                    };

                    saveGuild(guild.id, data);

                    return interaction.reply({
                        content:
                            `♻️ Se reinició la economía de <@${target.id}>.`
                    });
                }

                return interaction.reply({
                    content:
                        `⚙️ Ejecutaste **/eco ${sub}** correctamente.`
                });
            }
        }

        // ====================================================
        // SELECTS
        // ====================================================

        if (interaction.isStringSelectMenu()) {

            // ------------------------------------------------
            // MONEDA
            // ------------------------------------------------

            if (interaction.customId === "eco_currency") {

                const data = loadGuild(interaction.guild.id);

                data.currency =
                    interaction.values[0];

                const symbols = {
                    USD: "$",
                    COP: "$",
                    EUR: "€",
                    MXN: "$"
                };

                data.symbol =
                    symbols[data.currency] || "$";

                saveGuild(
                    interaction.guild.id,
                    data
                );

                const session =
                    setupSessions.get(interaction.user.id);

                await interaction.deferUpdate();

                await showSetup(
                    interaction,
                    session?.step || 1
                );

                return;
            }

            // ------------------------------------------------
            // TOGGLE
            // ------------------------------------------------

            if (interaction.customId === "eco_toggle") {

                const data =
                    loadGuild(interaction.guild.id);

                for (const key of Object.keys(data.settings)) {
                    data.settings[key] =
                        interaction.values.includes(key);
                }

                saveGuild(
                    interaction.guild.id,
                    data
                );

                await interaction.deferUpdate();

                const session =
                    setupSessions.get(interaction.user.id);

                await showSetup(
                    interaction,
                    session?.step || 4
                );

                return;
            }

            // ------------------------------------------------
            // HELP
            // ------------------------------------------------

            if (interaction.customId === "help_category") {

                const category =
                    interaction.values[0];

                const categories = {

                    economy: [
                        "`/balance`",
                        "`/money`",
                        "`/daily`",
                        "`/weekly`",
                        "`/monthly`",
                        "`/work`",
                        "`/pay`",
                        "`/deposit`",
                        "`/withdraw`",
                        "`/bankbalance`"
                    ],

                    jobs: [
                        "`/jobs`",
                        "`/job`",
                        "`/apply`",
                        "`/resign`",
                        "`/promote`",
                        "`/salary`",
                        "`/shift`",
                        "`/career`",
                        "`/skills`"
                    ],

                    commerce: [
                        "`/shop`",
                        "`/buy`",
                        "`/sell`",
                        "`/inventory`",
                        "`/market`",
                        "`/auction`",
                        "`/trade`",
                        "`/offer`"
                    ],

                    properties: [
                        "`/property`",
                        "`/properties`",
                        "`/buyhouse`",
                        "`/sellhouse`",
                        "`/rent`",
                        "`/upgradehouse`",
                        "`/garage`",
                        "`/vehicle`"
                    ],

                    missions: [
                        "`/missions`",
                        "`/mission`",
                        "`/claim`",
                        "`/achievements`",
                        "`/rewards`",
                        "`/streak`",
                        "`/milestones`"
                    ],

                    events: [
                        "`/event`",
                        "`/events`",
                        "`/giveaway`",
                        "`/raffle`",
                        "`/jackpot`",
                        "`/bonusday`",
                        "`/doublemoney`"
                    ],

                    vip: [
                        "`/vip`",
                        "`/vipshop`",
                        "`/vipbonus`",
                        "`/vipdaily`",
                        "`/vipstats`"
                    ],

                    stats: [
                        "`/economy`",
                        "`/economystats`",
                        "`/circulation`",
                        "`/inflation`",
                        "`/income`",
                        "`/expenses`",
                        "`/taxes`",
                        "`/leaderboard`"
                    ],

                    admin: [
                        "`/setup eco`",
                        "`/eco give`",
                        "`/eco remove`",
                        "`/eco set`",
                        "`/eco reset`",
                        "`/eco logs`",
                        "`/eco shop`",
                        "`/eco jobs`",
                        "`/eco event`"
                    ]
                };

                const names = {
                    economy: "💵 Economía",
                    jobs: "💼 Trabajos",
                    commerce: "🏪 Comercio",
                    properties: "🏠 Propiedades",
                    missions: "🎯 Misiones",
                    events: "🎁 Eventos",
                    vip: "👑 VIP",
                    stats: "📊 Estadísticas",
                    admin: "🔐 Administración"
                };

                await interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x7c3aed)
                            .setTitle(`🟣 ${names[category]}`)
                            .setDescription(
                                categories[category].join(" • ")
                            )
                    ]
                });

                return;
            }
        }

        // ====================================================
        // CHANNEL SELECT
        // ====================================================

        if (interaction.isChannelSelectMenu()) {

            const data =
                loadGuild(interaction.guild.id);

            const channelId =
                interaction.values[0];

            if (interaction.customId === "eco_channel") {

                data.channels.economy =
                    channelId;

            }

            if (interaction.customId === "eco_logs") {

                data.channels.logs =
                    channelId;

            }

            saveGuild(
                interaction.guild.id,
                data
            );

            await interaction.deferUpdate();

            const session =
                setupSessions.get(interaction.user.id);

            await showSetup(
                interaction,
                session?.step || 1
            );

            return;
        }

        // ====================================================
        // ROLE SELECT
        // ====================================================

        if (interaction.isRoleSelectMenu()) {

            const data =
                loadGuild(interaction.guild.id);

            data.roles.economy =
                interaction.values[0];

            saveGuild(
                interaction.guild.id,
                data
            );

            await interaction.deferUpdate();

            const session =
                setupSessions.get(interaction.user.id);

            await showSetup(
                interaction,
                session?.step || 3
            );

            return;
        }

        // ====================================================
        // BOTONES
        // ====================================================

        if (interaction.isButton()) {

            // ------------------------------------------------
            // CERRAR
            // ------------------------------------------------

            if (interaction.customId === "eco_close") {

                setupSessions.delete(
                    interaction.user.id
                );

                return interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0x64748b)
                            .setTitle("⚙️ Configuración cerrada")
                            .setDescription(
                                "La configuración de **SW Economy** fue cerrada."
                            )
                    ],
                    components: []
                });
            }

            // ------------------------------------------------
            // PREV
            // ------------------------------------------------

            if (
                interaction.customId.startsWith("eco_prev_")
            ) {

                const current =
                    Number(
                        interaction.customId
                            .split("_")[2]
                    );

                await interaction.deferUpdate();

                await showSetup(
                    interaction,
                    Math.max(1, current - 1)
                );

                return;
            }

            // ------------------------------------------------
            // NEXT
            // ------------------------------------------------

            if (
                interaction.customId.startsWith("eco_next_")
            ) {

                const current =
                    Number(
                        interaction.customId
                            .split("_")[2]
                    );

                if (current >= 6) {

                    setupSessions.delete(
                        interaction.user.id
                    );

                    const data =
                        loadGuild(interaction.guild.id);

                    await interaction.update({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x22c55e)
                                .setTitle("✅ SW Economy configurado")
                                .setDescription(
                                    `La economía de **${interaction.guild.name}** quedó configurada correctamente.`
                                )
                                .addFields(
                                    {
                                        name: "💰 Moneda",
                                        value:
                                            `${data.emoji} ${data.currency}`
                                    },
                                    {
                                        name: "💵 Presupuesto",
                                        value:
                                            money(data.budget, data)
                                    },
                                    {
                                        name: "📋 Logs",
                                        value:
                                            data.channels.logs
                                                ? `<#${data.channels.logs}>`
                                                : "No configurado"
                                    }
                                )
                        ],
                        components: []
                    });

                    return;
                }

                await interaction.deferUpdate();

                await showSetup(
                    interaction,
                    current + 1
                );

                return;
            }

            // ------------------------------------------------
            // SYMBOL
            // ------------------------------------------------

            if (interaction.customId === "eco_symbol") {

                const modal =
                    new ModalBuilder()
                        .setCustomId("modal_symbol")
                        .setTitle("💲 Cambiar símbolo");

                const input =
                    new TextInputBuilder()
                        .setCustomId("symbol")
                        .setLabel("Símbolo de la moneda")
                        .setPlaceholder("$")
                        .setRequired(true)
                        .setMaxLength(5)
                        .setStyle(TextInputStyle.Short);

                modal.addComponents(
                    new ActionRowBuilder()
                        .addComponents(input)
                );

                return interaction.showModal(modal);
            }

            // ------------------------------------------------
            // EMOJI
            // ------------------------------------------------

            if (interaction.customId === "eco_emoji") {

                const modal =
                    new ModalBuilder()
                        .setCustomId("modal_emoji")
                        .setTitle("😀 Emoji de la economía");

                const input =
                    new TextInputBuilder()
                        .setCustomId("emoji")
                        .setLabel("Emoji")
                        .setPlaceholder("💰")
                        .setRequired(true)
                        .setMaxLength(100)
                        .setStyle(TextInputStyle.Short);

                modal.addComponents(
                    new ActionRowBuilder()
                        .addComponents(input)
                );

                return interaction.showModal(modal);
            }

            // ------------------------------------------------
            // BUDGET
            // ------------------------------------------------

            if (interaction.customId === "eco_budget") {

                const modal =
                    new ModalBuilder()
                        .setCustomId("modal_budget")
                        .setTitle("💵 Presupuesto del servidor");

                const input =
                    new TextInputBuilder()
                        .setCustomId("budget")
                        .setLabel("Presupuesto")
                        .setPlaceholder("10000000000")
                        .setRequired(true)
                        .setMaxLength(20)
                        .setStyle(TextInputStyle.Short);

                modal.addComponents(
                    new ActionRowBuilder()
                        .addComponents(input)
                );

                return interaction.showModal(modal);
            }
        }

        // ====================================================
        // MODALES
        // ====================================================

        if (interaction.isModalSubmit()) {

            const data =
                loadGuild(interaction.guild.id);

            if (interaction.customId === "modal_symbol") {

                const value =
                    interaction.fields.getTextInputValue("symbol");

                data.symbol = value;

                saveGuild(
                    interaction.guild.id,
                    data
                );

                await interaction.reply({
                    content:
                        `✅ Símbolo cambiado a **${value}**.`,
                    ephemeral: true
                });

                return;
            }

            if (interaction.customId === "modal_emoji") {

                const value =
                    interaction.fields.getTextInputValue("emoji");

                data.emoji = value;

                saveGuild(
                    interaction.guild.id,
                    data
                );

                await interaction.reply({
                    content:
                        `✅ Emoji cambiado a ${value}.`,
                    ephemeral: true
                });

                return;
            }

            if (interaction.customId === "modal_budget") {

                const raw =
                    interaction.fields.getTextInputValue("budget");

                const value =
                    Number(
                        raw.replace(/[^\d]/g, "")
                    );

                if (!Number.isFinite(value) || value < 0) {
                    return interaction.reply({
                        content:
                            "❌ El presupuesto no es válido.",
                        ephemeral: true
                    });
                }

                data.budget = value;

                saveGuild(
                    interaction.guild.id,
                    data
                );

                await interaction.reply({
                    content:
                        `✅ Presupuesto establecido en **${money(value, data)}**.`,
                    ephemeral: true
                });

                return;
            }
        }

    } catch (error) {

        console.error("❌ Error en interacción:", error);

        if (!interaction.replied && !interaction.deferred) {

            await interaction.reply({
                content:
                    "❌ Ocurrió un error procesando la interacción.",
                ephemeral: true
            }).catch(() => {});
        }
    }
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
