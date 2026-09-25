import { supabase } from '../supabaseClient';

const LOCAL_STORAGE_KEY_ANNOUNCEMENTS = 'discord_announcements_webhook_cfg_v2';
const LOCAL_STORAGE_KEY_EVENTS = 'discord_events_webhook_cfg_v2';
const LOCAL_STORAGE_KEY_PRACTICES = 'discord_practices_webhook_cfg_v2';

export const SCUB_LOGO_URL = 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/scub_logo.png';
export const DTP_LOGO_URL = 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/dtp_logo.png';

// Defaults for Announcements
export const DEFAULT_BOT_NAME = 'SCUB • Sheriff Criminal Unit Bureau';
export const DEFAULT_HEADER_TEXT = 'Nueva publicación en la BBDD de la SCUB';
export const DEFAULT_FOOTER_TEXT = 'SCUB • Sheriff Criminal Unit Bureau';
export const DEFAULT_REMINDER_TEXT = 'Confirmad lectura en la propia Base de Datos.';

// Defaults for Calendar Events
export const DEFAULT_EVENTS_BOT_NAME = 'SCUB • Calendario de Operaciones';
export const DEFAULT_EVENTS_HEADER_TEXT = 'Nuevo Evento Programado en el Calendario';
export const DEFAULT_EVENTS_FOOTER_TEXT = 'SCUB • Calendario Oficial de Eventos';
export const DEFAULT_EVENTS_REMINDER_TEXT = 'Confirmad asistencia inscribiéndoos en el Calendario del Dashboard.';

// Defaults for Practices
export const DEFAULT_PRACTICES_BOT_NAME = 'DTP • Detective Training Program';
export const DEFAULT_PRACTICES_HEADER_TEXT = 'Convocatoria de Práctica / Instrucción Oficial';
export const DEFAULT_PRACTICES_FOOTER_TEXT = 'DTP • Detective Training Program';
export const DEFAULT_PRACTICES_REMINDER_TEXT = 'Confirmad asistencia inscribiéndoos en el apartado de Formación.';

/**
 * Automatically format and normalize role mentions for Discord
 * Converts <@1306619156052967471>, @1306619156052967471, or just 1306619156052967471 to <@&1306619156052967471>
 */
export function formatRoleMention(input) {
    if (!input || typeof input !== 'string') return '';
    const trimmed = input.trim();
    if (!trimmed) return '';

    if (trimmed === '@everyone' || trimmed === '@here') return trimmed;

    // Already correct role mention <@&1234567890>
    if (/^<@&\d+>$/.test(trimmed)) return trimmed;

    // User tag format <@1234567890> mistakenly used for role -> fix to <@&1234567890>
    const matchUserTag = trimmed.match(/^<@!?(\d+)>$/);
    if (matchUserTag) return `<@&${matchUserTag[1]}>`;

    // Starts with @ or & followed by digits
    const matchAtNumber = trimmed.match(/^[@&](\d+)$/);
    if (matchAtNumber) return `<@&${matchAtNumber[1]}>`;

    // Only numbers (Discord Snowflake ID length 15-22 digits)
    if (/^\d{15,22}$/.test(trimmed)) return `<@&${trimmed}>`;

    return trimmed;
}

/**
 * Clean & convert HTML content from ReactQuill to Discord Markdown
 */
export function formatHtmlToDiscordMarkdown(html) {
    if (!html) return '';

    let text = html;

    // Replace headers
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n');
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n');

    // Replace bold, italic, underline, strikethrough
    text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    text = text.replace(/<u[^>]*>(.*?)<\/u>/gi, '__$1__');
    text = text.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');
    text = text.replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~');

    // Replace code blocks & inline code
    text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n```\n$1\n```\n');
    text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

    // Replace blockquotes
    text = text.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '\n> $1\n');

    // Replace links <a href="url">text</a> -> [text](url)
    text = text.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

    // Replace lists
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '\n• $1');

    // Replace paragraph breaks and line breaks
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<p[^>]*>/gi, '');
    text = text.replace(/<br\s*[\/]?>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<div[^>]*>/gi, '');

    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–');

    // Normalize multiple newlines
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    return text;
}

// ==============================================================================
// 1. ANNOUNCEMENTS DISCORD WEBHOOK FUNCTIONS
// ==============================================================================

export async function getDiscordWebhookConfig() {
    const defaultConfig = {
        webhookUrl: '',
        enabled: false,
        rolePing: '',
        botName: DEFAULT_BOT_NAME,
        botAvatar: SCUB_LOGO_URL,
        footerText: DEFAULT_FOOTER_TEXT,
        customHeader: DEFAULT_HEADER_TEXT,
        reminderText: DEFAULT_REMINDER_TEXT
    };

    try {
        const { data, error } = await supabase.rpc('get_discord_webhook_config');
        if (!error && data) {
            const config = {
                webhookUrl: data.webhook_url || '',
                enabled: !!data.enabled,
                rolePing: formatRoleMention(data.role_ping || ''),
                botName: data.bot_name || DEFAULT_BOT_NAME,
                botAvatar: data.bot_avatar || SCUB_LOGO_URL,
                footerText: data.footer_text || DEFAULT_FOOTER_TEXT,
                customHeader: data.custom_header || DEFAULT_HEADER_TEXT,
                reminderText: data.reminder_text !== undefined ? data.reminder_text : DEFAULT_REMINDER_TEXT
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(config));
            } catch (e) {}
            return config;
        }

        const { data: rows, error: tableError } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', [
                'discord_announcements_webhook_url',
                'discord_announcements_webhook_enabled',
                'discord_announcements_webhook_role_ping',
                'discord_announcements_bot_name',
                'discord_announcements_bot_avatar',
                'discord_announcements_footer_text',
                'discord_announcements_custom_header',
                'discord_announcements_reminder_text'
            ]);

        if (!tableError && rows && rows.length > 0) {
            const configMap = {};
            rows.forEach(r => { configMap[r.key] = r.value; });

            const config = {
                webhookUrl: configMap['discord_announcements_webhook_url'] || '',
                enabled: configMap['discord_announcements_webhook_enabled'] === 'true',
                rolePing: formatRoleMention(configMap['discord_announcements_webhook_role_ping'] || ''),
                botName: configMap['discord_announcements_bot_name'] || DEFAULT_BOT_NAME,
                botAvatar: configMap['discord_announcements_bot_avatar'] || SCUB_LOGO_URL,
                footerText: configMap['discord_announcements_footer_text'] || DEFAULT_FOOTER_TEXT,
                customHeader: configMap['discord_announcements_custom_header'] || DEFAULT_HEADER_TEXT,
                reminderText: configMap['discord_announcements_reminder_text'] !== undefined ? configMap['discord_announcements_reminder_text'] : DEFAULT_REMINDER_TEXT
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(config));
            } catch (e) {}
            return config;
        }
    } catch (err) {
        console.warn('Could not load announcements webhook config:', err);
    }

    try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY_ANNOUNCEMENTS);
        if (cached) return { ...defaultConfig, ...JSON.parse(cached) };
    } catch (e) {}

    return defaultConfig;
}

export async function saveDiscordWebhookConfig({
    webhookUrl,
    enabled,
    rolePing = '',
    botName = DEFAULT_BOT_NAME,
    botAvatar = SCUB_LOGO_URL,
    footerText = DEFAULT_FOOTER_TEXT,
    customHeader = DEFAULT_HEADER_TEXT,
    reminderText = DEFAULT_REMINDER_TEXT
}) {
    const cleanUrl = (webhookUrl || '').trim();
    const cleanPing = formatRoleMention(rolePing);
    const isEnabled = Boolean(enabled);
    const cleanBotName = (botName || DEFAULT_BOT_NAME).trim();
    const cleanBotAvatar = (botAvatar || SCUB_LOGO_URL).trim();
    const cleanFooterText = (footerText || DEFAULT_FOOTER_TEXT).trim();
    const cleanHeader = (customHeader || DEFAULT_HEADER_TEXT).trim();
    const cleanReminder = (reminderText !== undefined ? reminderText : DEFAULT_REMINDER_TEXT).trim();

    try {
        const { error } = await supabase.rpc('save_discord_webhook_config', {
            p_webhook_url: cleanUrl,
            p_enabled: isEnabled,
            p_role_ping: cleanPing,
            p_bot_name: cleanBotName,
            p_bot_avatar: cleanBotAvatar,
            p_footer_text: cleanFooterText,
            p_custom_header: cleanHeader,
            p_reminder_text: cleanReminder
        });

        if (error) {
            await supabase.from('app_settings').upsert([
                { key: 'discord_announcements_webhook_url', value: cleanUrl, updated_at: new Date().toISOString() },
                { key: 'discord_announcements_webhook_enabled', value: isEnabled ? 'true' : 'false', updated_at: new Date().toISOString() },
                { key: 'discord_announcements_webhook_role_ping', value: cleanPing, updated_at: new Date().toISOString() },
                { key: 'discord_announcements_bot_name', value: cleanBotName, updated_at: new Date().toISOString() },
                { key: 'discord_announcements_bot_avatar', value: cleanBotAvatar, updated_at: new Date().toISOString() },
                { key: 'discord_announcements_footer_text', value: cleanFooterText, updated_at: new Date().toISOString() },
                { key: 'discord_announcements_custom_header', value: cleanHeader, updated_at: new Date().toISOString() },
                { key: 'discord_announcements_reminder_text', value: cleanReminder, updated_at: new Date().toISOString() }
            ]);
        }

        const newConfig = {
            webhookUrl: cleanUrl,
            enabled: isEnabled,
            rolePing: cleanPing,
            botName: cleanBotName,
            botAvatar: cleanBotAvatar,
            footerText: cleanFooterText,
            customHeader: cleanHeader,
            reminderText: cleanReminder
        };

        try {
            localStorage.setItem(LOCAL_STORAGE_KEY_ANNOUNCEMENTS, JSON.stringify(newConfig));
        } catch (e) {}

        return { success: true, config: newConfig };
    } catch (err) {
        console.error('Error saving discord webhook config:', err);
        throw err;
    }
}

export async function testDiscordWebhook({
    webhookUrl,
    rolePing = '',
    botName = DEFAULT_BOT_NAME,
    botAvatar = SCUB_LOGO_URL,
    footerText = DEFAULT_FOOTER_TEXT,
    customHeader = DEFAULT_HEADER_TEXT,
    reminderText = DEFAULT_REMINDER_TEXT
}) {
    if (!webhookUrl || !webhookUrl.trim().startsWith('https://')) {
        throw new Error('La URL del webhook debe ser una URL válida que comience con https://');
    }

    const avatar = (botAvatar || '').trim() || SCUB_LOGO_URL;
    const name = (botName || '').trim() || DEFAULT_BOT_NAME;
    const footer = (footerText || '').trim() || DEFAULT_FOOTER_TEXT;
    const header = (customHeader || '').trim() || DEFAULT_HEADER_TEXT;
    const reminder = (reminderText !== undefined ? reminderText : DEFAULT_REMINDER_TEXT).trim();
    const formattedPing = formatRoleMention(rolePing);

    let contentMessage = undefined;
    if (formattedPing) {
        contentMessage = `${formattedPing} 🔔 **Notificación de Prueba de Coordinación**\n*${header}*`;
    }

    const reminderMarkdown = reminder ? `\n\n*${reminder}*` : '';

    const payload = {
        username: name,
        avatar_url: avatar,
        content: contentMessage,
        allowed_mentions: {
            parse: ['roles', 'users', 'everyone']
        },
        embeds: [
            {
                title: '🧪 Prueba de Conexión de Webhook Exitosa',
                description: `Este es un mensaje de prueba enviado desde el **Panel de Coordinación** para el tablón de anuncios.\n\nEl servicio está correctamente configurado y transmitirá los anuncios oficiales publicados en el Dashboard.${reminderMarkdown}`,
                color: 0x10B981, // Verde esmeralda
                fields: [
                    { name: '📊 Estado', value: '✅ Conexión verificada', inline: true },
                    { name: '🤖 Nombre de Bot', value: `\`${name}\``, inline: true },
                    { name: '🎯 Mención', value: formattedPing ? `\`${formattedPing}\`` : '*Sin mención*', inline: false }
                ],
                footer: { text: footer, icon_url: avatar },
                timestamp: new Date().toISOString()
            }
        ]
    };

    const response = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let errText = '';
        try {
            const errJson = await response.json();
            errText = errJson.message || JSON.stringify(errJson);
        } catch (e) {
            errText = `HTTP Error ${response.status} (${response.statusText})`;
        }
        throw new Error(`Discord rechazó el webhook (${response.status}): ${errText}`);
    }

    return { success: true };
}

export async function sendAnnouncementToDiscord({ title, content, pinned, images = [], author = {}, forceSend = false }) {
    try {
        const config = await getDiscordWebhookConfig();

        if (!forceSend) {
            if (!config.enabled || !config.webhookUrl || !config.webhookUrl.trim().startsWith('https://')) {
                return { skipped: true };
            }
        }

        const targetUrl = config.webhookUrl.trim();
        const cleanMarkdown = formatHtmlToDiscordMarkdown(content);
        const maxDescLength = 3800;
        let finalDescription = cleanMarkdown.length > maxDescLength
            ? cleanMarkdown.substring(0, maxDescLength) + '\n\n*... [Texto truncado por longitud. Ver anuncio completo en la BBDD]*'
            : cleanMarkdown;

        const reminder = (config.reminderText !== undefined ? config.reminderText : DEFAULT_REMINDER_TEXT).trim();
        if (reminder) {
            finalDescription = finalDescription ? `${finalDescription}\n\n*${reminder}*` : `*${reminder}*`;
        }

        const authorName = [author?.nombre, author?.apellido].filter(Boolean).join(' ') || 'SCUB Staff';
        const authorRank = author?.rango ? `[${author.rango}]` : '';
        const authorFull = `${authorRank} ${authorName}`.trim();

        const embedColor = pinned ? 0xF59E0B : 0x3B82F6;
        const embedTitle = pinned ? `📌 [COMUNICADO OFICIAL FIJADO] ${title}` : `📢 ${title}`;

        const botAvatar = (config.botAvatar || '').trim() || SCUB_LOGO_URL;
        const botName = (config.botName || '').trim() || DEFAULT_BOT_NAME;
        const footerText = (config.footerText || '').trim() || DEFAULT_FOOTER_TEXT;
        const customHeader = (config.customHeader || '').trim() || DEFAULT_HEADER_TEXT;
        const formattedPing = formatRoleMention(config.rolePing);

        const embed = {
            title: embedTitle,
            description: finalDescription || '*Sin descripción*',
            color: embedColor,
            author: {
                name: authorFull || 'Personal de Coordinación / SCUB',
                icon_url: author?.profile_image || author?.avatar_url || botAvatar
            },
            footer: {
                text: footerText,
                icon_url: botAvatar
            },
            timestamp: new Date().toISOString()
        };

        if (images && images.length > 0 && typeof images[0] === 'string' && images[0].startsWith('http')) {
            embed.image = { url: images[0] };
        }

        if (images && images.length > 1) {
            const extraImages = images.slice(1).filter(img => typeof img === 'string' && img.startsWith('http'));
            if (extraImages.length > 0) {
                embed.fields = [
                    {
                        name: '📎 Archivos Adjuntos Adicionales',
                        value: extraImages.map((img, idx) => `• [Imagen adjunta #${idx + 2}](${img})`).join('\n'),
                        inline: false
                    }
                ];
            }
        }

        let messageContent = undefined;
        if (formattedPing) {
            messageContent = `${formattedPing} 📢 **${customHeader}**`;
        }

        const payload = {
            username: botName,
            avatar_url: botAvatar,
            content: messageContent,
            allowed_mentions: {
                parse: ['roles', 'users', 'everyone']
            },
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson.message || JSON.stringify(errJson);
            } catch (e) {
                errText = `HTTP Error ${response.status} (${response.statusText})`;
            }
            console.error('Failed to send announcement to Discord:', errText);
            return { success: false, error: errText };
        }

        return { success: true };
    } catch (err) {
        console.error('Error in sendAnnouncementToDiscord:', err);
        return { success: false, error: err.message };
    }
}

// ==============================================================================
// 2. PRACTICES (DTP) DISCORD WEBHOOK FUNCTIONS
// ==============================================================================

export async function getDiscordPracticesWebhookConfig() {
    const defaultConfig = {
        webhookUrl: '',
        enabled: false,
        rolePing: '',
        botName: DEFAULT_PRACTICES_BOT_NAME,
        botAvatar: DTP_LOGO_URL,
        footerText: DEFAULT_PRACTICES_FOOTER_TEXT,
        customHeader: DEFAULT_PRACTICES_HEADER_TEXT,
        reminderText: DEFAULT_PRACTICES_REMINDER_TEXT
    };

    try {
        const { data, error } = await supabase.rpc('get_discord_practices_webhook_config');
        if (!error && data) {
            const config = {
                webhookUrl: data.webhook_url || '',
                enabled: !!data.enabled,
                rolePing: formatRoleMention(data.role_ping || ''),
                botName: data.bot_name || DEFAULT_PRACTICES_BOT_NAME,
                botAvatar: data.bot_avatar || DTP_LOGO_URL,
                footerText: data.footer_text || DEFAULT_PRACTICES_FOOTER_TEXT,
                customHeader: data.custom_header || DEFAULT_PRACTICES_HEADER_TEXT,
                reminderText: data.reminder_text !== undefined ? data.reminder_text : DEFAULT_PRACTICES_REMINDER_TEXT
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY_PRACTICES, JSON.stringify(config));
            } catch (e) {}
            return config;
        }

        const { data: rows, error: tableError } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', [
                'discord_practices_webhook_url',
                'discord_practices_webhook_enabled',
                'discord_practices_webhook_role_ping',
                'discord_practices_bot_name',
                'discord_practices_bot_avatar',
                'discord_practices_footer_text',
                'discord_practices_custom_header',
                'discord_practices_reminder_text'
            ]);

        if (!tableError && rows && rows.length > 0) {
            const configMap = {};
            rows.forEach(r => { configMap[r.key] = r.value; });

            const config = {
                webhookUrl: configMap['discord_practices_webhook_url'] || '',
                enabled: configMap['discord_practices_webhook_enabled'] === 'true',
                rolePing: formatRoleMention(configMap['discord_practices_webhook_role_ping'] || ''),
                botName: configMap['discord_practices_bot_name'] || DEFAULT_PRACTICES_BOT_NAME,
                botAvatar: configMap['discord_practices_bot_avatar'] || DTP_LOGO_URL,
                footerText: configMap['discord_practices_footer_text'] || DEFAULT_PRACTICES_FOOTER_TEXT,
                customHeader: configMap['discord_practices_custom_header'] || DEFAULT_PRACTICES_HEADER_TEXT,
                reminderText: configMap['discord_practices_reminder_text'] !== undefined ? configMap['discord_practices_reminder_text'] : DEFAULT_PRACTICES_REMINDER_TEXT
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY_PRACTICES, JSON.stringify(config));
            } catch (e) {}
            return config;
        }
    } catch (err) {
        console.warn('Could not load practices webhook config:', err);
    }

    try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY_PRACTICES);
        if (cached) return { ...defaultConfig, ...JSON.parse(cached) };
    } catch (e) {}

    return defaultConfig;
}

export async function saveDiscordPracticesWebhookConfig({
    webhookUrl,
    enabled,
    rolePing = '',
    botName = DEFAULT_PRACTICES_BOT_NAME,
    botAvatar = DTP_LOGO_URL,
    footerText = DEFAULT_PRACTICES_FOOTER_TEXT,
    customHeader = DEFAULT_PRACTICES_HEADER_TEXT,
    reminderText = DEFAULT_PRACTICES_REMINDER_TEXT
}) {
    const cleanUrl = (webhookUrl || '').trim();
    const cleanPing = formatRoleMention(rolePing);
    const isEnabled = Boolean(enabled);
    const cleanBotName = (botName || DEFAULT_PRACTICES_BOT_NAME).trim();
    const cleanBotAvatar = (botAvatar || DTP_LOGO_URL).trim();
    const cleanFooterText = (footerText || DEFAULT_PRACTICES_FOOTER_TEXT).trim();
    const cleanHeader = (customHeader || DEFAULT_PRACTICES_HEADER_TEXT).trim();
    const cleanReminder = (reminderText !== undefined ? reminderText : DEFAULT_PRACTICES_REMINDER_TEXT).trim();

    try {
        const { error } = await supabase.rpc('save_discord_practices_webhook_config', {
            p_webhook_url: cleanUrl,
            p_enabled: isEnabled,
            p_role_ping: cleanPing,
            p_bot_name: cleanBotName,
            p_bot_avatar: cleanBotAvatar,
            p_footer_text: cleanFooterText,
            p_custom_header: cleanHeader,
            p_reminder_text: cleanReminder
        });

        if (error) {
            await supabase.from('app_settings').upsert([
                { key: 'discord_practices_webhook_url', value: cleanUrl, updated_at: new Date().toISOString() },
                { key: 'discord_practices_webhook_enabled', value: isEnabled ? 'true' : 'false', updated_at: new Date().toISOString() },
                { key: 'discord_practices_webhook_role_ping', value: cleanPing, updated_at: new Date().toISOString() },
                { key: 'discord_practices_bot_name', value: cleanBotName, updated_at: new Date().toISOString() },
                { key: 'discord_practices_bot_avatar', value: cleanBotAvatar, updated_at: new Date().toISOString() },
                { key: 'discord_practices_footer_text', value: cleanFooterText, updated_at: new Date().toISOString() },
                { key: 'discord_practices_custom_header', value: cleanHeader, updated_at: new Date().toISOString() },
                { key: 'discord_practices_reminder_text', value: cleanReminder, updated_at: new Date().toISOString() }
            ]);
        }

        const newConfig = {
            webhookUrl: cleanUrl,
            enabled: isEnabled,
            rolePing: cleanPing,
            botName: cleanBotName,
            botAvatar: cleanBotAvatar,
            footerText: cleanFooterText,
            customHeader: cleanHeader,
            reminderText: cleanReminder
        };

        try {
            localStorage.setItem(LOCAL_STORAGE_KEY_PRACTICES, JSON.stringify(newConfig));
        } catch (e) {}

        return { success: true, config: newConfig };
    } catch (err) {
        console.error('Error saving discord practices webhook config:', err);
        throw err;
    }
}

export async function testDiscordPracticesWebhook({
    webhookUrl,
    rolePing = '',
    botName = DEFAULT_PRACTICES_BOT_NAME,
    botAvatar = DTP_LOGO_URL,
    footerText = DEFAULT_PRACTICES_FOOTER_TEXT,
    customHeader = DEFAULT_PRACTICES_HEADER_TEXT,
    reminderText = DEFAULT_PRACTICES_REMINDER_TEXT
}) {
    if (!webhookUrl || !webhookUrl.trim().startsWith('https://')) {
        throw new Error('La URL del webhook debe ser una URL válida que comience con https://');
    }

    const avatar = (botAvatar || '').trim() || DTP_LOGO_URL;
    const name = (botName || '').trim() || DEFAULT_PRACTICES_BOT_NAME;
    const footer = (footerText || '').trim() || DEFAULT_PRACTICES_FOOTER_TEXT;
    const header = (customHeader || '').trim() || DEFAULT_PRACTICES_HEADER_TEXT;
    const reminder = (reminderText !== undefined ? reminderText : DEFAULT_PRACTICES_REMINDER_TEXT).trim();
    const formattedPing = formatRoleMention(rolePing);

    let contentMessage = undefined;
    if (formattedPing) {
        contentMessage = `${formattedPing} 🔔 **${header}**`;
    }

    const reminderMarkdown = reminder ? `\n\n*${reminder}*` : '';

    const payload = {
        username: name,
        avatar_url: avatar,
        content: contentMessage,
        allowed_mentions: {
            parse: ['roles', 'users', 'everyone']
        },
        embeds: [
            {
                title: '🎯 [PRÁCTICA DTP] Instrucción de Tiro & Balística de Combate',
                description: `Se convoca a todos los aspirantes y detectives a la sesión de instrucción técnica en campo de tiro y análisis de calibres.${reminderMarkdown}`,
                color: 0xF59E0B, // Dorado / Ámbar
                fields: [
                    { name: '📅 Fecha & Hora', value: 'Viernes 26/09/2026 • 20:00', inline: true },
                    { name: '👮 Instructor Principal', value: '[Sargento] James Miller (#104)', inline: true },
                    { name: '📋 Modalidad', value: 'Instrucción Práctica Obligatoria', inline: true },
                    { name: '👥 Instructores de Apoyo', value: '• Detective Sarah Connor\n• Detective Alex Murphy', inline: false }
                ],
                footer: { text: footer, icon_url: avatar },
                timestamp: new Date().toISOString()
            }
        ]
    };

    const response = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let errText = '';
        try {
            const errJson = await response.json();
            errText = errJson.message || JSON.stringify(errJson);
        } catch (e) {
            errText = `HTTP Error ${response.status} (${response.statusText})`;
        }
        throw new Error(`Discord rechazó el webhook de prácticas (${response.status}): ${errText}`);
    }

    return { success: true };
}

export async function sendPracticeToDiscord({
    practiceTitle,
    practiceType = '',
    practiceDescription = '',
    eventDate,
    eventTime = '',
    organizer = {},
    instructors = [],
    notes = '',
    forceSend = false
}) {
    try {
        const config = await getDiscordPracticesWebhookConfig();

        if (!forceSend) {
            if (!config.enabled || !config.webhookUrl || !config.webhookUrl.trim().startsWith('https://')) {
                return { skipped: true };
            }
        }

        const targetUrl = config.webhookUrl.trim();
        const botAvatar = (config.botAvatar || '').trim() || DTP_LOGO_URL;
        const botName = (config.botName || '').trim() || DEFAULT_PRACTICES_BOT_NAME;
        const footerText = (config.footerText || '').trim() || DEFAULT_PRACTICES_FOOTER_TEXT;
        const customHeader = (config.customHeader || '').trim() || DEFAULT_PRACTICES_HEADER_TEXT;
        const formattedPing = formatRoleMention(config.rolePing);

        // Clean & format descriptions
        const cleanDesc = formatHtmlToDiscordMarkdown(practiceDescription || '');
        const cleanNotes = formatHtmlToDiscordMarkdown(notes || '');

        let fullDescription = '';
        if (cleanDesc) fullDescription += cleanDesc;
        if (cleanNotes) {
            fullDescription += (fullDescription ? '\n\n**Observaciones / Instrucciones:**\n' : '**Observaciones / Instrucciones:**\n') + cleanNotes;
        }

        const reminder = (config.reminderText !== undefined ? config.reminderText : DEFAULT_PRACTICES_REMINDER_TEXT).trim();
        if (reminder) {
            fullDescription = fullDescription ? `${fullDescription}\n\n*${reminder}*` : `*${reminder}*`;
        }

        // Format Date string
        let formattedDate = eventDate;
        try {
            const d = new Date(eventDate);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                formattedDate = `${day}/${month}/${year}`;
                if (eventTime) {
                    formattedDate += ` • ${eventTime}`;
                }
            }
        } catch (e) {}

        const organizerName = [organizer?.nombre, organizer?.apellido].filter(Boolean).join(' ') || 'Instructor DTP';
        const organizerRank = organizer?.rango ? `[${organizer.rango}]` : '';
        const organizerBadge = organizer?.no_placa ? `(#${organizer.no_placa})` : '';
        const organizerFull = `${organizerRank} ${organizerName} ${organizerBadge}`.trim();

        const fields = [
            { name: '📅 Fecha y Hora', value: formattedDate || 'Por determinar', inline: true },
            { name: '👮 Instructor Principal', value: organizerFull, inline: true }
        ];

        if (practiceType) {
            fields.push({ name: '📋 Tipo de Práctica', value: practiceType, inline: true });
        }

        if (instructors && instructors.length > 0) {
            const instList = instructors.map(inst => {
                const name = typeof inst === 'string' ? inst : [inst?.nombre, inst?.apellido].filter(Boolean).join(' ');
                const badge = inst?.no_placa ? `(#${inst.no_placa})` : '';
                return `• ${name} ${badge}`.trim();
            }).join('\n');

            if (instList) {
                fields.push({ name: '👥 Instructores de Apoyo', value: instList, inline: false });
            }
        }

        const embed = {
            title: `🎯 [CONVOCATORIA PRÁCTICA] ${practiceTitle || 'Práctica Oficial de Formación'}`,
            description: fullDescription || '*Convocatoria de práctica emitida por el equipo de instrucción.*',
            color: 0xF59E0B, // Color ámbar / dorado de DTP
            author: {
                name: organizerFull || 'DTP • Detective Training Program',
                icon_url: organizer?.profile_image || organizer?.avatar_url || botAvatar
            },
            fields: fields,
            footer: {
                text: footerText,
                icon_url: botAvatar
            },
            timestamp: new Date().toISOString()
        };

        let messageContent = undefined;
        if (formattedPing) {
            messageContent = `${formattedPing} 🎯 **${customHeader}**`;
        }

        const payload = {
            username: botName,
            avatar_url: botAvatar,
            content: messageContent,
            allowed_mentions: {
                parse: ['roles', 'users', 'everyone']
            },
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson.message || JSON.stringify(errJson);
            } catch (e) {
                errText = `HTTP Error ${response.status} (${response.statusText})`;
            }
            console.error('Failed to send practice to Discord:', errText);
            return { success: false, error: errText };
        }

        return { success: true };
    } catch (err) {
        console.error('Error in sendPracticeToDiscord:', err);
        return { success: false, error: err.message };
    }
}

// ==============================================================================
// 3. CALENDAR EVENTS DISCORD WEBHOOK FUNCTIONS
// ==============================================================================

export async function getDiscordEventsWebhookConfig() {
    const defaultConfig = {
        webhookUrl: '',
        enabled: false,
        rolePing: '',
        botName: DEFAULT_EVENTS_BOT_NAME,
        botAvatar: SCUB_LOGO_URL,
        footerText: DEFAULT_EVENTS_FOOTER_TEXT,
        customHeader: DEFAULT_EVENTS_HEADER_TEXT,
        reminderText: DEFAULT_EVENTS_REMINDER_TEXT
    };

    try {
        const { data, error } = await supabase.rpc('get_discord_events_webhook_config');
        if (error) {
            console.warn('RPC get_discord_events_webhook_config error, fallback to direct query:', error);
            const { data: rows, error: tableErr } = await supabase
                .from('app_settings')
                .select('key, value')
                .like('key', 'discord_events_%');

            if (tableErr || !rows || rows.length === 0) {
                const cached = localStorage.getItem(LOCAL_STORAGE_KEY_EVENTS);
                if (cached) return { ...defaultConfig, ...JSON.parse(cached) };
                return defaultConfig;
            }

            const map = {};
            rows.forEach(r => { map[r.key] = r.value; });

            const result = {
                webhookUrl: map['discord_events_webhook_url'] || '',
                enabled: map['discord_events_webhook_enabled'] === 'true',
                rolePing: map['discord_events_webhook_role_ping'] || '',
                botName: map['discord_events_bot_name'] || DEFAULT_EVENTS_BOT_NAME,
                botAvatar: map['discord_events_bot_avatar'] || SCUB_LOGO_URL,
                footerText: map['discord_events_footer_text'] || DEFAULT_EVENTS_FOOTER_TEXT,
                customHeader: map['discord_events_custom_header'] || DEFAULT_EVENTS_HEADER_TEXT,
                reminderText: map['discord_events_reminder_text'] !== undefined ? map['discord_events_reminder_text'] : DEFAULT_EVENTS_REMINDER_TEXT
            };

            try {
                localStorage.setItem(LOCAL_STORAGE_KEY_EVENTS, JSON.stringify(result));
            } catch (e) {}

            return result;
        }

        const res = {
            webhookUrl: data?.webhook_url || '',
            enabled: !!data?.enabled,
            rolePing: data?.role_ping || '',
            botName: data?.bot_name || DEFAULT_EVENTS_BOT_NAME,
            botAvatar: data?.bot_avatar || SCUB_LOGO_URL,
            footerText: data?.footer_text || DEFAULT_EVENTS_FOOTER_TEXT,
            customHeader: data?.custom_header || DEFAULT_EVENTS_HEADER_TEXT,
            reminderText: data?.reminder_text !== undefined ? data?.reminder_text : DEFAULT_EVENTS_REMINDER_TEXT
        };

        try {
            localStorage.setItem(LOCAL_STORAGE_KEY_EVENTS, JSON.stringify(res));
        } catch (e) {}

        return res;
    } catch (err) {
        console.error('Error in getDiscordEventsWebhookConfig:', err);
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY_EVENTS);
        if (cached) {
            try { return { ...defaultConfig, ...JSON.parse(cached) }; } catch (e) {}
        }
        return defaultConfig;
    }
}

export async function saveDiscordEventsWebhookConfig({
    webhookUrl,
    enabled,
    rolePing = '',
    botName = DEFAULT_EVENTS_BOT_NAME,
    botAvatar = SCUB_LOGO_URL,
    footerText = DEFAULT_EVENTS_FOOTER_TEXT,
    customHeader = DEFAULT_EVENTS_HEADER_TEXT,
    reminderText = DEFAULT_EVENTS_REMINDER_TEXT
}) {
    const cleanUrl = (webhookUrl || '').trim();
    const isEnabled = Boolean(enabled);
    const cleanPing = (rolePing || '').trim();
    const cleanBotName = (botName || '').trim() || DEFAULT_EVENTS_BOT_NAME;
    const cleanBotAvatar = (botAvatar || '').trim();
    const cleanFooterText = (footerText || '').trim() || DEFAULT_EVENTS_FOOTER_TEXT;
    const cleanHeader = (customHeader || '').trim() || DEFAULT_EVENTS_HEADER_TEXT;
    const cleanReminder = reminderText !== undefined ? reminderText.trim() : DEFAULT_EVENTS_REMINDER_TEXT;

    try {
        const { error } = await supabase.rpc('save_discord_events_webhook_config', {
            p_webhook_url: cleanUrl,
            p_enabled: isEnabled,
            p_role_ping: cleanPing,
            p_bot_name: cleanBotName,
            p_bot_avatar: cleanBotAvatar,
            p_footer_text: cleanFooterText,
            p_custom_header: cleanHeader,
            p_reminder_text: cleanReminder
        });

        if (error) {
            console.warn('RPC save_discord_events_webhook_config failed, trying direct upsert:', error);
            await supabase.from('app_settings').upsert([
                { key: 'discord_events_webhook_url', value: cleanUrl, updated_at: new Date().toISOString() },
                { key: 'discord_events_webhook_enabled', value: isEnabled ? 'true' : 'false', updated_at: new Date().toISOString() },
                { key: 'discord_events_webhook_role_ping', value: cleanPing, updated_at: new Date().toISOString() },
                { key: 'discord_events_bot_name', value: cleanBotName, updated_at: new Date().toISOString() },
                { key: 'discord_events_bot_avatar', value: cleanBotAvatar, updated_at: new Date().toISOString() },
                { key: 'discord_events_footer_text', value: cleanFooterText, updated_at: new Date().toISOString() },
                { key: 'discord_events_custom_header', value: cleanHeader, updated_at: new Date().toISOString() },
                { key: 'discord_events_reminder_text', value: cleanReminder, updated_at: new Date().toISOString() }
            ]);
        }

        const newConfig = {
            webhookUrl: cleanUrl,
            enabled: isEnabled,
            rolePing: cleanPing,
            botName: cleanBotName,
            botAvatar: cleanBotAvatar,
            footerText: cleanFooterText,
            customHeader: cleanHeader,
            reminderText: cleanReminder
        };

        try {
            localStorage.setItem(LOCAL_STORAGE_KEY_EVENTS, JSON.stringify(newConfig));
        } catch (e) {}

        return { success: true, config: newConfig };
    } catch (err) {
        console.error('Error saving discord events webhook config:', err);
        throw err;
    }
}

export async function testDiscordEventsWebhook({
    webhookUrl,
    rolePing = '',
    botName = DEFAULT_EVENTS_BOT_NAME,
    botAvatar = SCUB_LOGO_URL,
    footerText = DEFAULT_EVENTS_FOOTER_TEXT,
    customHeader = DEFAULT_EVENTS_HEADER_TEXT,
    reminderText = DEFAULT_EVENTS_REMINDER_TEXT
}) {
    if (!webhookUrl || !webhookUrl.trim().startsWith('https://')) {
        throw new Error('La URL del webhook debe ser una URL válida que comience con https://');
    }

    const avatar = (botAvatar || '').trim() || SCUB_LOGO_URL;
    const name = (botName || '').trim() || DEFAULT_EVENTS_BOT_NAME;
    const footer = (footerText || '').trim() || DEFAULT_EVENTS_FOOTER_TEXT;
    const header = (customHeader || '').trim() || DEFAULT_EVENTS_HEADER_TEXT;
    const reminder = (reminderText !== undefined ? reminderText : DEFAULT_EVENTS_REMINDER_TEXT).trim();
    const formattedPing = formatRoleMention(rolePing);

    let contentMessage = undefined;
    if (formattedPing) {
        contentMessage = `${formattedPing} 📅 **${header}**`;
    }

    const reminderMarkdown = reminder ? `\n\n*${reminder}*` : '';

    const payload = {
        username: name,
        avatar_url: avatar,
        content: contentMessage,
        allowed_mentions: {
            parse: ['roles', 'users', 'everyone']
        },
        embeds: [
            {
                title: '📅 [EVENTO / OPERATIVO] Briefing General de Seguridad Ciudadana',
                description: `Reunión operativa y coordinación táctica en sala de juntas para el despliegue del fin de semana.${reminderMarkdown}`,
                color: 0x10B981, // Esmeralda / Verde brillante
                fields: [
                    { name: '📅 Fecha y Hora', value: 'Sábado 27/09/2026 • 21:30', inline: true },
                    { name: '👮 Convocado por', value: '[Teniente] Matthew Kleiner (#782)', inline: true },
                    { name: '📍 Lugar', value: 'Sala de Briefing Principal - Davis', inline: false }
                ],
                footer: { text: footer, icon_url: avatar },
                timestamp: new Date().toISOString()
            }
        ]
    };

    const response = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        let errText = '';
        try {
            const errJson = await response.json();
            errText = errJson.message || JSON.stringify(errJson);
        } catch (e) {
            errText = `HTTP Error ${response.status} (${response.statusText})`;
        }
        throw new Error(`Discord rechazó el webhook de eventos (${response.status}): ${errText}`);
    }

    return { success: true };
}

export async function sendEventToDiscord({
    title,
    description = '',
    eventDate,
    eventType = 'reunion',
    author = {},
    forceSend = false
}) {
    try {
        let config = await getDiscordEventsWebhookConfig();

        // Fallback: If Events webhook is not configured or disabled, check Practices (if practice) or Announcements
        if (!config.enabled || !config.webhookUrl || !config.webhookUrl.trim().startsWith('https://')) {
            if (eventType === 'practica') {
                const pracCfg = await getDiscordPracticesWebhookConfig();
                if (pracCfg.enabled && pracCfg.webhookUrl && pracCfg.webhookUrl.trim().startsWith('https://')) {
                    config = pracCfg;
                }
            }
            if (!config.enabled || !config.webhookUrl || !config.webhookUrl.trim().startsWith('https://')) {
                const annCfg = await getDiscordWebhookConfig();
                if (annCfg.enabled && annCfg.webhookUrl && annCfg.webhookUrl.trim().startsWith('https://')) {
                    config = annCfg;
                }
            }
        }

        if (!forceSend) {
            if (!config.enabled || !config.webhookUrl || !config.webhookUrl.trim().startsWith('https://')) {
                console.warn('Webhook de eventos no habilitado o sin URL válida configurada.');
                return { skipped: true };
            }
        }

        const targetUrl = config.webhookUrl.trim();
        const formattedPing = formatRoleMention(config.rolePing);

        // Customize Embed Theme based on eventType
        let embedColor = 0x3B82F6; // Blue default
        let embedTitlePrefix = '📅 [EVENTO]';
        let defaultHeader = 'Nuevo Evento en el Calendario';
        let typeBadge = 'Reunión / Briefing';
        let botAvatarDefault = SCUB_LOGO_URL;

        const cleanType = (eventType || 'reunion').toLowerCase();
        if (cleanType === 'reunion' || cleanType.includes('reunión') || cleanType.includes('briefing')) {
            embedColor = 0x3B82F6; // Azul
            embedTitlePrefix = '👥 [REUNIÓN OFICIAL]';
            defaultHeader = 'Convocatoria de Reunión / Briefing de Unidad';
            typeBadge = 'Reunión General';
        } else if (cleanType === 'practica' || cleanType.includes('práctica') || cleanType.includes('formacion') || cleanType.includes('instruccion')) {
            embedColor = 0xF59E0B; // Dorado / Ámbar
            embedTitlePrefix = '🎯 [PRÁCTICA / INSTRUCCIÓN]';
            defaultHeader = 'Convocatoria de Práctica / Instrucción Oficial';
            typeBadge = 'Práctica DTP / Formación';
            botAvatarDefault = DTP_LOGO_URL;
        } else if (cleanType === 'operativo' || cleanType.includes('despliegue') || cleanType.includes('redada')) {
            embedColor = 0xEF4444; // Rojo
            embedTitlePrefix = '🚨 [OPERATIVO / DESPLIEGUE]';
            defaultHeader = 'Convocatoria de Operativo Táctico Especial';
            typeBadge = 'Operativo Táctico';
        } else if (cleanType === 'ceremonia' || cleanType.includes('acto') || cleanType.includes('ascenso')) {
            embedColor = 0x8B5CF6; // Púrpura
            embedTitlePrefix = '🏆 [ACTO OFICIAL & CONDECORACIONES]';
            defaultHeader = 'Convocatoria de Acto Oficial & Reconocimientos';
            typeBadge = 'Ceremonia / Acto';
        } else {
            embedColor = 0x10B981; // Verde
            embedTitlePrefix = '📅 [EVENTO PROGRAMADO]';
            defaultHeader = 'Nuevo Evento Programado en el Calendario';
            typeBadge = 'Evento General';
        }

        const botAvatar = (config.botAvatar || '').trim() || botAvatarDefault;
        const botName = (config.botName || '').trim() || DEFAULT_EVENTS_BOT_NAME;
        const footerText = (config.footerText || '').trim() || DEFAULT_EVENTS_FOOTER_TEXT;
        const customHeader = (config.customHeader || '').trim() || defaultHeader;

        const cleanDesc = formatHtmlToDiscordMarkdown(description || '');
        const reminder = (config.reminderText !== undefined ? config.reminderText : DEFAULT_EVENTS_REMINDER_TEXT).trim();
        let finalDescription = cleanDesc;
        if (reminder) {
            finalDescription = finalDescription ? `${finalDescription}\n\n*${reminder}*` : `*${reminder}*`;
        }

        let formattedDateStr = 'Fecha por determinar';
        try {
            const d = new Date(eventDate);
            if (!isNaN(d.getTime())) {
                formattedDateStr = d.toLocaleString('es-ES', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        } catch (e) {}

        const authorName = [author?.nombre, author?.apellido].filter(Boolean).join(' ') || 'Coordinación';
        const authorRank = author?.rango ? `[${author.rango}]` : '';
        const authorBadge = author?.no_placa ? `(#${author.no_placa})` : '';
        const authorFull = `${authorRank} ${authorName} ${authorBadge}`.trim();

        const embed = {
            title: `${embedTitlePrefix} ${title || 'Sin Título'}`,
            description: finalDescription || '*Sin descripción adicional.*',
            color: embedColor,
            author: {
                name: authorFull || 'Coordinación de SCUB',
                icon_url: author?.profile_image || author?.avatar_url || botAvatar
            },
            fields: [
                { name: '📅 Fecha & Hora', value: formattedDateStr, inline: true },
                { name: '📋 Tipo de Evento', value: typeBadge, inline: true },
                { name: '👤 Organizado por', value: authorFull || 'Personal Autorizado', inline: false }
            ],
            footer: {
                text: footerText,
                icon_url: botAvatar
            },
            timestamp: new Date().toISOString()
        };

        let messageContent = undefined;
        if (formattedPing) {
            messageContent = `${formattedPing} **${customHeader}**`;
        }

        const payload = {
            username: botName,
            avatar_url: botAvatar,
            content: messageContent,
            allowed_mentions: {
                parse: ['roles', 'users', 'everyone']
            },
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson.message || JSON.stringify(errJson);
            } catch (e) {
                errText = `HTTP Error ${response.status} (${response.statusText})`;
            }
            console.error('Failed to send event to Discord:', errText);
            return { success: false, error: errText };
        }

        return { success: true };
    } catch (err) {
        console.error('Error in sendEventToDiscord:', err);
        return { success: false, error: err.message };
    }
}

// ==============================================================================
// 4. INTERNAL AFFAIRS (IA) SANCTIONS DISCORD WEBHOOK & BANNERS INTEGRATION
// ==============================================================================

const LOCAL_STORAGE_KEY_IA_SANCTIONS = 'discord_ia_sanctions_webhook_cfg_v2';
const LOCAL_STORAGE_KEY_IA_BANNERS = 'discord_ia_banners_cfg_v2';

export const IA_LOGO_URL = 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/ia_logo.png';
export const DEFAULT_IA_BOT_NAME = 'INTERNAL AFFAIRS BUREAU';
export const DEFAULT_IA_FOOTER_TEXT = 'Internal Affairs Bureau • Régimen Disciplinario';

export const IA_SANCTION_TYPES = {
    leves_sargentos: {
        id: 'leves_sargentos',
        name: 'LEVES SARGENTOS',
        label: 'Falta Leve (Sargentos)',
        color: 0x22C55E, // Lima / Verde
        hexColor: '#22c55e',
        tag: '🟢 LEVE SARGENTOS'
    },
    leves_ia: {
        id: 'leves_ia',
        name: 'LEVES IA',
        label: 'Falta Leve (Asuntos Internos)',
        color: 0x10B981, // Esmeralda
        hexColor: '#10b981',
        tag: '🟢 LEVE IA'
    },
    medias: {
        id: 'medias',
        name: 'MEDIAS',
        label: 'Falta Media',
        color: 0xF59E0B, // Ámbar / Amarillo
        hexColor: '#f59e0b',
        tag: '🟡 MEDIA'
    },
    graves: {
        id: 'graves',
        name: 'GRAVES',
        label: 'Falta Grave',
        color: 0xEF4444, // Rojo
        hexColor: '#ef4444',
        tag: '🔴 GRAVE'
    },
    despido: {
        id: 'despido',
        name: 'DESPIDO',
        label: 'Despido / Expulsión',
        color: 0x991B1B, // Carmesí / Rojo Oscuro
        hexColor: '#991b1b',
        tag: '⚫ DESPIDO'
    }
};

/**
 * Retrieve Discord IA Sanctions Webhook configuration
 */
export async function getDiscordIASanctionsWebhookConfig() {
    let config = {
        webhookUrl: '',
        enabled: false,
        rolePing: '',
        botName: DEFAULT_IA_BOT_NAME,
        botAvatar: IA_LOGO_URL,
        footerText: DEFAULT_IA_FOOTER_TEXT,
        customHeader: 'MOTIVO: {motivo}',
        reminderText: ''
    };

    try {
        const { data, error } = await supabase.rpc('get_discord_ia_sanctions_webhook_config');
        if (!error && data) {
            config = {
                webhookUrl: data.webhook_url || '',
                enabled: !!data.enabled,
                rolePing: data.role_ping || '',
                botName: data.bot_name || DEFAULT_IA_BOT_NAME,
                botAvatar: data.bot_avatar || IA_LOGO_URL,
                footerText: data.footer_text || DEFAULT_IA_FOOTER_TEXT,
                customHeader: data.custom_header || 'MOTIVO: {motivo}',
                reminderText: data.reminder_text || ''
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY_IA_SANCTIONS, JSON.stringify(config));
            } catch (e) {}
            return config;
        }
    } catch (rpcErr) {
        console.warn('RPC get_discord_ia_sanctions_webhook_config failed:', rpcErr);
    }

    try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY_IA_SANCTIONS);
        if (local) {
            const parsed = JSON.parse(local);
            return { ...config, ...parsed };
        }
    } catch (e) {}

    return config;
}

/**
 * Save Discord IA Sanctions Webhook configuration
 */
export async function saveDiscordIASanctionsWebhookConfig(cfg) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_IA_SANCTIONS, JSON.stringify(cfg));
    } catch (e) {}

    try {
        const { error } = await supabase.rpc('save_discord_ia_sanctions_webhook_config', {
            p_webhook_url: cfg.webhookUrl || '',
            p_enabled: !!cfg.enabled,
            p_role_ping: cfg.rolePing || '',
            p_bot_name: cfg.botName || DEFAULT_IA_BOT_NAME,
            p_bot_avatar: cfg.botAvatar || '',
            p_footer_text: cfg.footerText || DEFAULT_IA_FOOTER_TEXT,
            p_custom_header: cfg.customHeader || 'MOTIVO: {motivo}',
            p_reminder_text: cfg.reminderText || ''
        });
        if (error) {
            console.error('Error saving IA webhook config to database:', error);
            throw error;
        }
        return { success: true };
    } catch (err) {
        console.error('Failed to persist IA webhook config to supabase:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Retrieve IA Sanction Banners for all 5 tiers
 */
export async function getIASanctionBanners() {
    let banners = {
        leves_sargentos: '',
        leves_ia: '',
        medias: '',
        graves: '',
        despido: ''
    };

    try {
        const { data, error } = await supabase.rpc('get_ia_sanction_banners');
        if (!error && data) {
            banners = {
                leves_sargentos: data.leves_sargentos || '',
                leves_ia: data.leves_ia || '',
                medias: data.medias || '',
                graves: data.graves || '',
                despido: data.despido || ''
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY_IA_BANNERS, JSON.stringify(banners));
            } catch (e) {}
            return banners;
        }
    } catch (rpcErr) {
        console.warn('RPC get_ia_sanction_banners failed, falling back:', rpcErr);
    }

    try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY_IA_BANNERS);
        if (local) {
            const parsed = JSON.parse(local);
            return { ...banners, ...parsed };
        }
    } catch (e) {}

    return banners;
}

/**
 * Save IA Sanction Banners to database
 */
export async function saveIASanctionBanners(banners) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_IA_BANNERS, JSON.stringify(banners));
    } catch (e) {}

    try {
        const { error } = await supabase.rpc('save_ia_sanction_banners', {
            p_leves_sargentos: banners.leves_sargentos || '',
            p_leves_ia: banners.leves_ia || '',
            p_medias: banners.medias || '',
            p_graves: banners.graves || '',
            p_despido: banners.despido || ''
        });
        if (error) {
            console.error('Error saving IA sanction banners to DB:', error);
            throw error;
        }
        return { success: true };
    } catch (err) {
        console.error('Failed to persist IA banners to supabase:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Test IA Sanctions Discord Webhook
 */
export async function testIASanctionsDiscordWebhook(customConfig = null, sanctionType = 'leves_ia') {
    const cfg = customConfig || await getDiscordIASanctionsWebhookConfig();
    if (!cfg.webhookUrl || !cfg.webhookUrl.trim().startsWith('https://')) {
        throw new Error('La URL del webhook no es válida.');
    }

    const banners = await getIASanctionBanners();
    const bannerUrl = banners[sanctionType] || '';

    return sendIASanctionToDiscord({
        sanctionType: sanctionType,
        officerName: 'Agente de Prueba',
        officerBadge: '999',
        officerRank: 'Detective I',
        reason: 'PRUEBA DE CONFIGURACIÓN DE WEBHOOK IA',
        sanctionApplied: 'Notificación de verificación del sistema de Asuntos Internos.',
        sanctionerName: 'Dirección de Asuntos Internos',
        sanctionDate: new Date().toISOString().split('T')[0],
        evidenceUrl: 'https://ejemplo.com/evidencias',
        notes: 'Este es un mensaje de prueba emitido desde la Base de Datos.',
        customBannerUrl: bannerUrl,
        author: { nombre: 'Test', apellido: 'Bot', rango: 'IAB Supervisor', no_placa: '00' },
        forceSend: true,
        customConfig: cfg
    });
}

/**
 * Dispatch IA Sanction Notice to Discord Webhook
 */
export async function sendIASanctionToDiscord({
    sanctionType = 'leves_ia',
    officerName = '',
    officerBadge = '',
    officerRank = '',
    reason = '',
    sanctionApplied = '',
    sanctionerName = '',
    sanctionDate = '',
    evidenceUrl = '',
    notes = '',
    customBannerUrl = '',
    author = {},
    forceSend = false,
    customConfig = null
}) {
    try {
        const config = customConfig || await getDiscordIASanctionsWebhookConfig();

        if (!forceSend) {
            if (!config.enabled || !config.webhookUrl || !config.webhookUrl.trim().startsWith('https://')) {
                console.warn('Webhook de sanciones IA no habilitado o sin URL válida configurada.');
                return { skipped: true };
            }
        }

        const targetUrl = config.webhookUrl.trim();
        const formattedPing = formatRoleMention(config.rolePing);

        const typeInfo = IA_SANCTION_TYPES[sanctionType] || IA_SANCTION_TYPES.leves_ia;

        // Determine banner
        let bannerImage = customBannerUrl;
        if (!bannerImage) {
            const allBanners = await getIASanctionBanners();
            bannerImage = allBanners[sanctionType] || '';
        }

        const botAvatar = (config.botAvatar || '').trim() || IA_LOGO_URL;
        const botName = (config.botName || '').trim() || DEFAULT_IA_BOT_NAME;
        const footerText = (config.footerText || '').trim() || DEFAULT_IA_FOOTER_TEXT;

        const cleanReason = (reason || 'FALTA AL RÉGIMEN DISCIPLINARIO').trim().toUpperCase();
        const embedHeader = `MOTIVO: ${cleanReason}`;

        // Format Officer
        const officerBadgeStr = officerBadge ? `(#${officerBadge})` : '';
        const officerRankStr = officerRank ? `[${officerRank}]` : '';
        const formattedOfficer = `${officerRankStr} ${officerName} ${officerBadgeStr}`.trim() || 'No especificado';

        // Format Sanctioner
        const authorName = [author?.nombre, author?.apellido].filter(Boolean).join(' ');
        const authorBadge = author?.no_placa ? `(#${author.no_placa})` : '';
        const authorRank = author?.rango ? `[${author.rango}]` : '';
        const fallbackAuthor = `${authorRank} ${authorName} ${authorBadge}`.trim();
        const formattedSanctioner = (sanctionerName || fallbackAuthor || 'División de Asuntos Internos').trim();

        // Format Date
        let formattedDateStr = sanctionDate || new Date().toLocaleDateString('es-ES');
        try {
            const d = new Date(sanctionDate);
            if (!isNaN(d.getTime())) {
                formattedDateStr = d.toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            }
        } catch (e) {}

        const fields = [
            { name: '⚖️ Calificación de la Falta', value: `\`\`\`${typeInfo.name}\`\`\``, inline: true },
            { name: '📅 Fecha de Imposición', value: `\`\`\`${formattedDateStr}\`\`\``, inline: true }
        ];

        const embed = {
            title: embedHeader,
            color: typeInfo.color,
            fields: fields,
            footer: {
                text: footerText,
                icon_url: botAvatar
            },
            timestamp: new Date().toISOString()
        };

        if (bannerImage && bannerImage.trim().startsWith('http')) {
            embed.image = {
                url: bannerImage.trim()
            };
        }

        let messageContent = undefined;
        if (formattedPing) {
            messageContent = `${formattedPing} **NOTIFICACIÓN DISCIPLINARIA OFICIAL**`;
        }

        const payload = {
            username: botName,
            avatar_url: botAvatar,
            content: messageContent,
            allowed_mentions: {
                parse: ['roles', 'users', 'everyone']
            },
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson.message || JSON.stringify(errJson);
            } catch (e) {
                errText = `HTTP Error ${response.status} (${response.statusText})`;
            }
            console.error('Failed to send IA sanction to Discord:', errText);
            return { success: false, error: errText };
        }

        return { success: true };
    } catch (err) {
        console.error('Error in sendIASanctionToDiscord:', err);
        return { success: false, error: err.message };
    }
}

// ==============================================================================
// 5. COORDINATION ROSTER / MEMBERS DISCORD BROADCAST INTEGRATION
// ==============================================================================

const LOCAL_STORAGE_KEY_COORDINATION_ROSTER = 'discord_coordination_roster_cfg_v2';

export const DEFAULT_COORDINATION_ROSTER_DATA = [
    {
        id: 'coord',
        name: 'COORDINADOR',
        icon: '⚜️',
        members: []
    },
    {
        id: 'subcoord',
        name: 'SUBCOORDINADORA',
        icon: '⚡',
        members: []
    },
    {
        id: 'detective',
        name: 'DETECTIVE',
        icon: '🕵️',
        members: []
    },
    {
        id: 'field_agent',
        name: 'FIELD AGENT',
        icon: '⭐',
        members: []
    },
    {
        id: 'crim_analyst',
        name: 'CRIMINAL ANALYST',
        icon: '🧬',
        members: []
    },
    {
        id: 'contender',
        name: 'CONTENDER',
        icon: '📋',
        members: []
    }
];

/**
 * Retrieve Coordination Roster configuration & saved agents list
 */
export async function getCoordinationRosterConfig() {
    let config = {
        webhookUrl: '',
        enabled: true,
        rolePing: '',
        botName: 'SCUB • Sheriff Criminal Unit Bureau',
        botAvatar: SCUB_LOGO_URL,
        title: 'SHERIFF CRIMINAL UNIT BUREAU',
        bannerUrl: '',
        rosterData: DEFAULT_COORDINATION_ROSTER_DATA
    };

    try {
        const { data, error } = await supabase.rpc('get_coordination_roster_config');
        if (!error && data) {
            config = {
                webhookUrl: data.webhook_url || '',
                enabled: data.enabled !== undefined ? !!data.enabled : true,
                rolePing: data.role_ping || '',
                botName: data.bot_name || 'SCUB • Sheriff Criminal Unit Bureau',
                botAvatar: data.bot_avatar || SCUB_LOGO_URL,
                title: data.title || 'SHERIFF CRIMINAL UNIT BUREAU',
                bannerUrl: data.banner_url || '',
                rosterData: Array.isArray(data.roster_data) && data.roster_data.length > 0 
                    ? data.roster_data 
                    : DEFAULT_COORDINATION_ROSTER_DATA
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY_COORDINATION_ROSTER, JSON.stringify(config));
            } catch (e) {}
            return config;
        }
    } catch (rpcErr) {
        console.warn('RPC get_coordination_roster_config failed, falling back:', rpcErr);
    }

    try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY_COORDINATION_ROSTER);
        if (local) {
            const parsed = JSON.parse(local);
            return { ...config, ...parsed };
        }
    } catch (e) {}

    return config;
}

/**
 * Save Coordination Roster configuration & updated agents list
 */
export async function saveCoordinationRosterConfig({
    rosterData,
    webhookUrl = '',
    title = 'SHERIFF CRIMINAL UNIT BUREAU',
    bannerUrl = '',
    rolePing = '',
    botName = 'SCUB • Sheriff Criminal Unit Bureau',
    botAvatar = '',
    enabled = true
}) {
    const configToSave = {
        rosterData: rosterData || DEFAULT_COORDINATION_ROSTER_DATA,
        webhookUrl: webhookUrl || '',
        title: title || 'SHERIFF CRIMINAL UNIT BUREAU',
        bannerUrl: bannerUrl || '',
        rolePing: rolePing || '',
        botName: botName || 'SCUB • Sheriff Criminal Unit Bureau',
        botAvatar: botAvatar || SCUB_LOGO_URL,
        enabled: !!enabled
    };

    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_COORDINATION_ROSTER, JSON.stringify(configToSave));
    } catch (e) {}

    try {
        const { error } = await supabase.rpc('save_coordination_roster_config', {
            p_roster_data: configToSave.rosterData,
            p_webhook_url: configToSave.webhookUrl,
            p_title: configToSave.title,
            p_banner_url: configToSave.bannerUrl,
            p_role_ping: configToSave.rolePing,
            p_bot_name: configToSave.botName,
            p_bot_avatar: configToSave.botAvatar,
            p_enabled: configToSave.enabled
        });
        if (error) {
            console.error('Error saving Coordination Roster config to database:', error);
            throw error;
        }
        return { success: true };
    } catch (err) {
        console.error('Failed to persist Coordination Roster config to supabase:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Format a member item into Discord Mention string
 */
export function formatMemberMention(member) {
    if (!member) return '• N/A';
    if (typeof member === 'string') {
        const tag = member.trim();
        if (!tag) return '• N/A';
        if (/^\d{15,22}$/.test(tag)) return `• <@${tag}>`;
        if (/^<@!?\d+>$/.test(tag)) return `• ${tag}`;
        if (tag.startsWith('@')) return `• ${tag}`;
        return `• @${tag}`;
    }

    const discordId = (member.discordId || '').trim();
    const name = (member.name || '').trim();

    // Use Discord ID for Discord mention
    if (discordId) {
        if (/^\d{15,22}$/.test(discordId)) {
            return `• <@${discordId}>`;
        }
        if (/^<@!?\d+>$/.test(discordId)) {
            return `• ${discordId}`;
        }
        if (discordId.startsWith('@')) {
            return `• ${discordId}`;
        }
        return `• @${discordId}`;
    }

    // Fallback if no Discord ID was provided
    if (name) {
        if (name.startsWith('@')) return `• ${name}`;
        return `• @${name}`;
    }

    return '• N/A';
}

/**
 * Build Discord description text from Roster Data
 */
export function buildRosterDiscordMarkdown(rosterData) {
    if (!Array.isArray(rosterData) || rosterData.length === 0) {
        return '*No hay rangos configurados en la plantilla.*';
    }

    const sections = rosterData.map(rank => {
        const icon = rank.icon ? `${rank.icon} ` : '';
        const rankName = (rank.name || 'RANGO').toUpperCase();
        const header = `${icon}**__${rankName}__**`;

        const membersList = Array.isArray(rank.members) && rank.members.length > 0
            ? rank.members.map(m => formatMemberMention(m)).join('\n')
            : '• N/A';

        return `${header}\n\n${membersList}`;
    });

    return sections.join('\n\n');
}

/**
 * Dispatch Coordination Roster to Discord Webhook
 */
export async function sendCoordinationRosterToDiscord({
    rosterData,
    title = 'SHERIFF CRIMINAL UNIT BUREAU',
    bannerUrl = '',
    customConfig = null,
    forceSend = false,
    author = {}
}) {
    try {
        const config = customConfig || await getCoordinationRosterConfig();

        if (!forceSend) {
            if (!config.enabled || !config.webhookUrl || !config.webhookUrl.trim().startsWith('https://')) {
                console.warn('Webhook de Plantilla de Coordinación no configurado o inactivo.');
                return { skipped: true };
            }
        }

        const targetUrl = config.webhookUrl.trim();
        const formattedPing = formatRoleMention(config.rolePing);

        const botAvatar = (config.botAvatar || '').trim() || SCUB_LOGO_URL;
        const botName = (config.botName || '').trim() || 'SCUB • Sheriff Criminal Unit Bureau';
        const embedTitle = `🔍 ${title || 'SHERIFF CRIMINAL UNIT BUREAU'}`;

        const description = buildRosterDiscordMarkdown(rosterData || config.rosterData);

        const embed = {
            title: embedTitle,
            description: description,
            color: 0xC5A059, // Gold SCUB
            timestamp: new Date().toISOString()
        };

        const activeBanner = bannerUrl || config.bannerUrl;
        if (activeBanner && activeBanner.trim().startsWith('http')) {
            embed.image = {
                url: activeBanner.trim()
            };
        }

        let messageContent = undefined;
        if (formattedPing) {
            messageContent = `${formattedPing}`;
        }

        const payload = {
            username: botName,
            avatar_url: botAvatar,
            content: messageContent,
            allowed_mentions: {
                parse: ['roles', 'users', 'everyone']
            },
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson.message || JSON.stringify(errJson);
            } catch (e) {
                errText = `HTTP Error ${response.status} (${response.statusText})`;
            }
            console.error('Failed to send Coordination Roster to Discord:', errText);
            return { success: false, error: errText };
        }

        return { success: true };
    } catch (err) {
        console.error('Error in sendCoordinationRosterToDiscord:', err);
        return { success: false, error: err.message };
    }
}

// ==============================================================================
// 6. ASD ROSTER / AIR SUPPORT DIVISION DISCORD BROADCAST INTEGRATION
// ==============================================================================

const LOCAL_STORAGE_KEY_ASD_ROSTER = 'discord_asd_roster_cfg_v1';

export const DEFAULT_ASD_ROSTER_DATA = [
    {
        id: 'asd_com',
        name: 'COMANDANTE DE ASD',
        icon: '🎖️',
        members: []
    },
    {
        id: 'asd_cap',
        name: 'CAPITÁN DE ESCUADRÓN',
        icon: '⭐',
        members: []
    },
    {
        id: 'asd_pti',
        name: 'PILOTO TÁCTICO INSTRUCTOR',
        icon: '⚡',
        members: []
    },
    {
        id: 'asd_poe',
        name: 'PILOTO DE OPERACIONES ESPECIALES',
        icon: '🦅',
        members: []
    },
    {
        id: 'asd_tfo',
        name: 'OFICIAL DE VUELO TÁCTICO (TFO)',
        icon: '🎯',
        members: []
    },
    {
        id: 'asd_prac',
        name: 'PILOTO EN PRÁCTICAS',
        icon: '🚁',
        members: []
    }
];

/**
 * Retrieve ASD Roster configuration & saved agents list
 */
export async function getASDRosterConfig() {
    let config = {
        webhookUrl: '',
        enabled: true,
        rolePing: '',
        botName: 'ASD • Air Support Division',
        botAvatar: SCUB_LOGO_URL,
        title: 'AIR SUPPORT DIVISION • DIVISION ROSTER',
        bannerUrl: '',
        rosterData: DEFAULT_ASD_ROSTER_DATA
    };

    try {
        const { data, error } = await supabase.rpc('get_asd_roster_config');
        if (!error && data) {
            config = {
                webhookUrl: data.webhook_url || '',
                enabled: data.enabled !== undefined ? !!data.enabled : true,
                rolePing: data.role_ping || '',
                botName: data.bot_name || 'ASD • Air Support Division',
                botAvatar: data.bot_avatar || SCUB_LOGO_URL,
                title: data.title || 'AIR SUPPORT DIVISION • DIVISION ROSTER',
                bannerUrl: data.banner_url || '',
                rosterData: Array.isArray(data.roster_data) && data.roster_data.length > 0 
                    ? data.roster_data 
                    : DEFAULT_ASD_ROSTER_DATA
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY_ASD_ROSTER, JSON.stringify(config));
            } catch (e) {}
            return config;
        } else if (error) {
            // fallback direct table read
            const { data: rows } = await supabase
                .from('app_settings')
                .select('key, value')
                .like('key', 'discord_asd_roster_%');
            if (rows && rows.length > 0) {
                const map = {};
                rows.forEach(r => { map[r.key] = r.value; });
                let parsedRoster = DEFAULT_ASD_ROSTER_DATA;
                try {
                    if (map['discord_asd_roster_data']) {
                        parsedRoster = JSON.parse(map['discord_asd_roster_data']);
                    }
                } catch (e) {}

                config = {
                    webhookUrl: map['discord_asd_roster_webhook_url'] || '',
                    enabled: map['discord_asd_roster_webhook_enabled'] !== 'false',
                    rolePing: map['discord_asd_roster_role_ping'] || '',
                    botName: map['discord_asd_roster_bot_name'] || 'ASD • Air Support Division',
                    botAvatar: map['discord_asd_roster_bot_avatar'] || SCUB_LOGO_URL,
                    title: map['discord_asd_roster_title'] || 'AIR SUPPORT DIVISION • DIVISION ROSTER',
                    bannerUrl: map['discord_asd_roster_banner_url'] || '',
                    rosterData: Array.isArray(parsedRoster) && parsedRoster.length > 0 ? parsedRoster : DEFAULT_ASD_ROSTER_DATA
                };
                return config;
            }
        }
    } catch (rpcErr) {
        console.warn('RPC get_asd_roster_config failed, falling back:', rpcErr);
    }

    try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY_ASD_ROSTER);
        if (local) {
            const parsed = JSON.parse(local);
            return { ...config, ...parsed };
        }
    } catch (e) {}

    return config;
}

/**
 * Save ASD Roster configuration & updated agents list
 */
export async function saveASDRosterConfig({
    rosterData,
    webhookUrl = '',
    title = 'AIR SUPPORT DIVISION • DIVISION ROSTER',
    bannerUrl = '',
    rolePing = '',
    botName = 'ASD • Air Support Division',
    botAvatar = '',
    enabled = true
}) {
    const configToSave = {
        rosterData: rosterData || DEFAULT_ASD_ROSTER_DATA,
        webhookUrl: webhookUrl || '',
        title: title || 'AIR SUPPORT DIVISION • DIVISION ROSTER',
        bannerUrl: bannerUrl || '',
        rolePing: rolePing || '',
        botName: botName || 'ASD • Air Support Division',
        botAvatar: botAvatar || SCUB_LOGO_URL,
        enabled: !!enabled
    };

    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_ASD_ROSTER, JSON.stringify(configToSave));
    } catch (e) {}

    try {
        const { error } = await supabase.rpc('save_asd_roster_config', {
            p_roster_data: configToSave.rosterData,
            p_webhook_url: configToSave.webhookUrl,
            p_title: configToSave.title,
            p_banner_url: configToSave.bannerUrl,
            p_role_ping: configToSave.rolePing,
            p_bot_name: configToSave.botName,
            p_bot_avatar: configToSave.botAvatar,
            p_enabled: configToSave.enabled
        });
        if (error) {
            console.warn('RPC save_asd_roster_config failed, fallback to direct upsert:', error);
            // Fallback direct upsert to app_settings
            const entries = [
                { key: 'discord_asd_roster_data', value: JSON.stringify(configToSave.rosterData) },
                { key: 'discord_asd_roster_webhook_url', value: configToSave.webhookUrl },
                { key: 'discord_asd_roster_title', value: configToSave.title },
                { key: 'discord_asd_roster_banner_url', value: configToSave.bannerUrl },
                { key: 'discord_asd_roster_role_ping', value: configToSave.rolePing },
                { key: 'discord_asd_roster_bot_name', value: configToSave.botName },
                { key: 'discord_asd_roster_bot_avatar', value: configToSave.botAvatar },
                { key: 'discord_asd_roster_webhook_enabled', value: configToSave.enabled ? 'true' : 'false' }
            ];
            for (const item of entries) {
                await supabase.from('app_settings').upsert({ key: item.key, value: item.value, updated_at: new Date().toISOString() });
            }
        }
        return { success: true };
    } catch (err) {
        console.error('Failed to persist ASD Roster config to supabase:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Dispatch ASD Roster to Discord Webhook
 */
export async function sendASDRosterToDiscord({
    rosterData,
    title = 'AIR SUPPORT DIVISION • DIVISION ROSTER',
    bannerUrl = '',
    customConfig = null,
    forceSend = false,
    author = {}
}) {
    try {
        const config = customConfig || await getASDRosterConfig();

        if (!forceSend) {
            if (!config.enabled || !config.webhookUrl || !config.webhookUrl.trim().startsWith('https://')) {
                console.warn('Webhook de Plantilla ASD no configurado o inactivo.');
                return { skipped: true };
            }
        }

        const targetUrl = config.webhookUrl.trim();
        const formattedPing = formatRoleMention(config.rolePing);

        const botAvatar = (config.botAvatar || '').trim() || SCUB_LOGO_URL;
        const botName = (config.botName || '').trim() || 'ASD • Air Support Division';
        const embedTitle = `🚁 ${title || 'AIR SUPPORT DIVISION • DIVISION ROSTER'}`;

        const description = buildRosterDiscordMarkdown(rosterData || config.rosterData);

        const embed = {
            title: embedTitle,
            description: description,
            color: 0x0284C7, // ASD Sky / Cyan Blue (2, 132, 199)
            timestamp: new Date().toISOString()
        };

        const activeBanner = bannerUrl || config.bannerUrl;
        if (activeBanner && activeBanner.trim().startsWith('http')) {
            embed.image = {
                url: activeBanner.trim()
            };
        }

        let messageContent = undefined;
        if (formattedPing) {
            messageContent = `${formattedPing}`;
        }

        const payload = {
            username: botName,
            avatar_url: botAvatar,
            content: messageContent,
            allowed_mentions: {
                parse: ['roles', 'users', 'everyone']
            },
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson.message || JSON.stringify(errJson);
            } catch (e) {
                errText = `HTTP Error ${response.status} (${response.statusText})`;
            }
            console.error('Failed to send ASD Roster to Discord:', errText);
            return { success: false, error: errText };
        }

        return { success: true };
    } catch (err) {
        console.error('Error in sendASDRosterToDiscord:', err);
        return { success: false, error: err.message };
    }
}

// ==============================================================================
// 7. IA ROSTER / INTERNAL AFFAIRS BUREAU DISCORD BROADCAST INTEGRATION
// ==============================================================================

const LOCAL_STORAGE_KEY_IA_ROSTER = 'discord_ia_roster_cfg_v1';

export const DEFAULT_IA_ROSTER_DATA = [
    {
        id: 'ia_coord',
        name: 'COORDINADORA',
        icon: '⚖️',
        members: []
    },
    {
        id: 'ia_subcoord',
        name: 'SUBCOORDINADOR',
        icon: '⚡',
        members: []
    },
    {
        id: 'ia_oficina_disc',
        name: 'AGENTES OFICINA DISCIPLINARIA',
        icon: '🕵️',
        members: []
    },
    {
        id: 'ia_oficina_inv',
        name: 'AGENTES OFICINA DE INVESTIGACIÓN',
        icon: '🔍',
        members: []
    }
];

/**
 * Retrieve IA Roster configuration & saved agents list
 */
export async function getIARosterConfig() {
    let config = {
        webhookUrl: '',
        enabled: true,
        rolePing: '',
        botName: 'Internal Affairs Bureau',
        botAvatar: IA_LOGO_URL,
        title: 'INTERNAL AFFAIRS BUREAU - MIEMBROS',
        bannerUrl: '',
        rosterData: DEFAULT_IA_ROSTER_DATA
    };

    try {
        const { data, error } = await supabase.rpc('get_ia_roster_config');
        if (!error && data) {
            config = {
                webhookUrl: data.webhook_url || '',
                enabled: data.enabled !== undefined ? !!data.enabled : true,
                rolePing: data.role_ping || '',
                botName: data.bot_name || 'Internal Affairs Bureau',
                botAvatar: data.bot_avatar || IA_LOGO_URL,
                title: data.title || 'INTERNAL AFFAIRS BUREAU - MIEMBROS',
                bannerUrl: data.banner_url || '',
                rosterData: Array.isArray(data.roster_data) && data.roster_data.length > 0 
                    ? data.roster_data 
                    : DEFAULT_IA_ROSTER_DATA
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY_IA_ROSTER, JSON.stringify(config));
            } catch (e) {}
            return config;
        } else if (error) {
            // fallback direct table read
            const { data: rows } = await supabase
                .from('app_settings')
                .select('key, value')
                .like('key', 'discord_ia_roster_%');
            if (rows && rows.length > 0) {
                const map = {};
                rows.forEach(r => { map[r.key] = r.value; });
                let parsedRoster = DEFAULT_IA_ROSTER_DATA;
                try {
                    if (map['discord_ia_roster_data']) {
                        parsedRoster = JSON.parse(map['discord_ia_roster_data']);
                    }
                } catch (e) {}

                config = {
                    webhookUrl: map['discord_ia_roster_webhook_url'] || '',
                    enabled: map['discord_ia_roster_webhook_enabled'] !== 'false',
                    rolePing: map['discord_ia_roster_role_ping'] || '',
                    botName: map['discord_ia_roster_bot_name'] || 'Internal Affairs Bureau',
                    botAvatar: map['discord_ia_roster_bot_avatar'] || IA_LOGO_URL,
                    title: map['discord_ia_roster_title'] || 'INTERNAL AFFAIRS BUREAU - MIEMBROS',
                    bannerUrl: map['discord_ia_roster_banner_url'] || '',
                    rosterData: Array.isArray(parsedRoster) && parsedRoster.length > 0 ? parsedRoster : DEFAULT_IA_ROSTER_DATA
                };
                return config;
            }
        }
    } catch (rpcErr) {
        console.warn('RPC get_ia_roster_config failed, falling back:', rpcErr);
    }

    try {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY_IA_ROSTER);
        if (local) {
            const parsed = JSON.parse(local);
            return { ...config, ...parsed };
        }
    } catch (e) {}

    return config;
}

/**
 * Save IA Roster configuration & updated agents list
 */
export async function saveIARosterConfig({
    rosterData,
    webhookUrl = '',
    title = 'INTERNAL AFFAIRS BUREAU - MIEMBROS',
    bannerUrl = '',
    rolePing = '',
    botName = 'Internal Affairs Bureau',
    botAvatar = '',
    enabled = true
}) {
    const configToSave = {
        rosterData: rosterData || DEFAULT_IA_ROSTER_DATA,
        webhookUrl: webhookUrl || '',
        title: title || 'INTERNAL AFFAIRS BUREAU - MIEMBROS',
        bannerUrl: bannerUrl || '',
        rolePing: rolePing || '',
        botName: botName || 'Internal Affairs Bureau',
        botAvatar: botAvatar || IA_LOGO_URL,
        enabled: !!enabled
    };

    try {
        localStorage.setItem(LOCAL_STORAGE_KEY_IA_ROSTER, JSON.stringify(configToSave));
    } catch (e) {}

    try {
        const { error } = await supabase.rpc('save_ia_roster_config', {
            p_roster_data: configToSave.rosterData,
            p_webhook_url: configToSave.webhookUrl,
            p_title: configToSave.title,
            p_banner_url: configToSave.bannerUrl,
            p_role_ping: configToSave.rolePing,
            p_bot_name: configToSave.botName,
            p_bot_avatar: configToSave.botAvatar,
            p_enabled: configToSave.enabled
        });
        if (error) {
            console.warn('RPC save_ia_roster_config failed, fallback to direct upsert:', error);
            // Fallback direct upsert to app_settings
            const entries = [
                { key: 'discord_ia_roster_data', value: JSON.stringify(configToSave.rosterData) },
                { key: 'discord_ia_roster_webhook_url', value: configToSave.webhookUrl },
                { key: 'discord_ia_roster_title', value: configToSave.title },
                { key: 'discord_ia_roster_banner_url', value: configToSave.bannerUrl },
                { key: 'discord_ia_roster_role_ping', value: configToSave.rolePing },
                { key: 'discord_ia_roster_bot_name', value: configToSave.botName },
                { key: 'discord_ia_roster_bot_avatar', value: configToSave.botAvatar },
                { key: 'discord_ia_roster_webhook_enabled', value: configToSave.enabled ? 'true' : 'false' }
            ];
            for (const item of entries) {
                await supabase.from('app_settings').upsert({ key: item.key, value: item.value, updated_at: new Date().toISOString() });
            }
        }
        return { success: true };
    } catch (err) {
        console.error('Failed to persist IA Roster config to supabase:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Dispatch IA Roster to Discord Webhook
 */
export async function sendIARosterToDiscord({
    rosterData,
    title = 'INTERNAL AFFAIRS BUREAU - MIEMBROS',
    bannerUrl = '',
    customConfig = null,
    forceSend = false,
    author = {}
}) {
    try {
        const config = customConfig || await getIARosterConfig();

        if (!forceSend) {
            if (!config.enabled || !config.webhookUrl || !config.webhookUrl.trim().startsWith('https://')) {
                console.warn('Webhook de Plantilla IA no configurado o inactivo.');
                return { skipped: true };
            }
        }

        const targetUrl = config.webhookUrl.trim();
        const formattedPing = formatRoleMention(config.rolePing);

        const botAvatar = (config.botAvatar || '').trim() || IA_LOGO_URL;
        const botName = (config.botName || '').trim() || 'Internal Affairs Bureau';
        const embedTitle = `⚖️ ${title || 'INTERNAL AFFAIRS BUREAU - MIEMBROS'}`;

        const description = buildRosterDiscordMarkdown(rosterData || config.rosterData);

        const embed = {
            title: embedTitle,
            description: description,
            color: 0xDC2626, // Crimson / Red for IA
            timestamp: new Date().toISOString()
        };

        const activeBanner = bannerUrl || config.bannerUrl;
        if (activeBanner && activeBanner.trim().startsWith('http')) {
            embed.image = {
                url: activeBanner.trim()
            };
        }

        let messageContent = undefined;
        if (formattedPing) {
            messageContent = `${formattedPing}`;
        }

        const payload = {
            username: botName,
            avatar_url: botAvatar,
            content: messageContent,
            allowed_mentions: {
                parse: ['roles', 'users', 'everyone']
            },
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson.message || JSON.stringify(errJson);
            } catch (e) {
                errText = `HTTP Error ${response.status} (${response.statusText})`;
            }
            console.error('Failed to send IA Roster to Discord:', errText);
            return { success: false, error: errText };
        }

        return { success: true };
    } catch (err) {
        console.error('Error in sendIARosterToDiscord:', err);
        return { success: false, error: err.message };
    }
}

// ==============================================================================
// 7. IA COMPLAINTS / DENUNCIAS NOTIFICATIONS WEBHOOK
// ==============================================================================

const LOCAL_STORAGE_KEY_IA_COMPLAINTS = 'discord_ia_complaints_webhook_cfg_v1';
export const DEFAULT_IA_COMPLAINTS_BOT_NAME = 'IA • Notificaciones de Denuncias';
export const DEFAULT_IA_COMPLAINTS_CUSTOM_MSG = '⚠️ **Nueva Denuncia Ciudadana Recibida**. Por favor, revisad la Base de Datos para verificarla y asignarla.';

export async function getDiscordIAComplaintsWebhookConfig() {
    try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY_IA_COMPLAINTS);
        let config = null;
        if (cached) {
            try { config = JSON.parse(cached); } catch (e) { /* ignore */ }
        }

        const { data, error } = await supabase.rpc('get_discord_ia_complaints_webhook_config');
        if (!error && data) {
            const freshConfig = {
                webhookUrl: data.webhook_url || '',
                enabled: !!data.enabled,
                rolePing: data.role_ping || '',
                botName: data.bot_name || DEFAULT_IA_COMPLAINTS_BOT_NAME,
                botAvatar: data.bot_avatar || '',
                customMsg: data.custom_msg || DEFAULT_IA_COMPLAINTS_CUSTOM_MSG
            };
            localStorage.setItem(LOCAL_STORAGE_KEY_IA_COMPLAINTS, JSON.stringify(freshConfig));
            return freshConfig;
        }

        if (config) return config;

        // Fallback to direct app_settings query
        const { data: directData } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', [
                'discord_ia_complaints_webhook_url',
                'discord_ia_complaints_webhook_enabled',
                'discord_ia_complaints_webhook_role_ping',
                'discord_ia_complaints_webhook_bot_name',
                'discord_ia_complaints_webhook_bot_avatar',
                'discord_ia_complaints_webhook_custom_msg'
            ]);

        if (directData && directData.length > 0) {
            const map = {};
            directData.forEach(r => { map[r.key] = r.value; });
            const directConfig = {
                webhookUrl: map['discord_ia_complaints_webhook_url'] || '',
                enabled: map['discord_ia_complaints_webhook_enabled'] === 'true',
                rolePing: map['discord_ia_complaints_webhook_role_ping'] || '',
                botName: map['discord_ia_complaints_webhook_bot_name'] || DEFAULT_IA_COMPLAINTS_BOT_NAME,
                botAvatar: map['discord_ia_complaints_webhook_bot_avatar'] || '',
                customMsg: map['discord_ia_complaints_webhook_custom_msg'] || DEFAULT_IA_COMPLAINTS_CUSTOM_MSG
            };
            localStorage.setItem(LOCAL_STORAGE_KEY_IA_COMPLAINTS, JSON.stringify(directConfig));
            return directConfig;
        }

        return {
            webhookUrl: '',
            enabled: false,
            rolePing: '',
            botName: DEFAULT_IA_COMPLAINTS_BOT_NAME,
            botAvatar: '',
            customMsg: DEFAULT_IA_COMPLAINTS_CUSTOM_MSG
        };
    } catch (err) {
        console.error('Error in getDiscordIAComplaintsWebhookConfig:', err);
        return {
            webhookUrl: '',
            enabled: false,
            rolePing: '',
            botName: DEFAULT_IA_COMPLAINTS_BOT_NAME,
            botAvatar: '',
            customMsg: DEFAULT_IA_COMPLAINTS_CUSTOM_MSG
        };
    }
}

export async function saveDiscordIAComplaintsWebhookConfig(config) {
    try {
        const { data, error } = await supabase.rpc('save_discord_ia_complaints_webhook_config', {
            p_webhook_url: config.webhookUrl || '',
            p_enabled: !!config.enabled,
            p_role_ping: config.rolePing || '',
            p_bot_name: config.botName || DEFAULT_IA_COMPLAINTS_BOT_NAME,
            p_bot_avatar: config.botAvatar || '',
            p_custom_msg: config.customMsg || DEFAULT_IA_COMPLAINTS_CUSTOM_MSG
        });

        if (error) {
            // Direct app_settings fallback
            const updates = [
                { key: 'discord_ia_complaints_webhook_url', value: config.webhookUrl || '' },
                { key: 'discord_ia_complaints_webhook_enabled', value: config.enabled ? 'true' : 'false' },
                { key: 'discord_ia_complaints_webhook_role_ping', value: config.rolePing || '' },
                { key: 'discord_ia_complaints_webhook_bot_name', value: config.botName || DEFAULT_IA_COMPLAINTS_BOT_NAME },
                { key: 'discord_ia_complaints_webhook_bot_avatar', value: config.botAvatar || '' },
                { key: 'discord_ia_complaints_webhook_custom_msg', value: config.customMsg || DEFAULT_IA_COMPLAINTS_CUSTOM_MSG }
            ];
            const { error: directError } = await supabase.from('app_settings').upsert(updates);
            if (directError) throw directError;
        }

        localStorage.setItem(LOCAL_STORAGE_KEY_IA_COMPLAINTS, JSON.stringify({
            webhookUrl: config.webhookUrl || '',
            enabled: !!config.enabled,
            rolePing: config.rolePing || '',
            botName: config.botName || DEFAULT_IA_COMPLAINTS_BOT_NAME,
            botAvatar: config.botAvatar || '',
            customMsg: config.customMsg || DEFAULT_IA_COMPLAINTS_CUSTOM_MSG
        }));

        return { success: true };
    } catch (err) {
        console.error('Error saving IA Complaints Webhook config:', err);
        return { success: false, error: err.message };
    }
}

export async function testIAComplaintsDiscordWebhook(config) {
    try {
        if (!config?.webhookUrl || !config.webhookUrl.trim().startsWith('http')) {
            throw new Error('La URL del Webhook de Discord no es válida.');
        }

        const targetUrl = config.webhookUrl.trim();
        const formattedPing = formatRoleMention(config.rolePing);
        const botName = (config.botName || '').trim() || DEFAULT_IA_COMPLAINTS_BOT_NAME;
        const botAvatar = (config.botAvatar || '').trim() || IA_LOGO_URL;

        const embed = {
            title: '⚖️ PRUEBA DE CONEXIÓN: NOTIFICACIONES DE DENUNCIAS IA',
            description: '✅ **Webhook configurado correctamente.**\nLas nuevas denuncias recibidas a través del formulario de Asuntos Internos se enviarán a este canal.',
            color: 0x10B981,
            fields: [
                { name: '👤 Denunciante de Prueba', value: 'John Doe (📞 555-0192)', inline: true },
                { name: '🎯 Denunciado / Agente', value: 'Oficial Marcus Wright [#104]', inline: true },
                { name: '⚖️ Motivo', value: 'Uso Excesivo de la Fuerza / Abuso', inline: true },
                { name: '📋 Estado en Base de Datos', value: '📥 **Pendiente de Revisión y Asignación**', inline: false }
            ],
            footer: {
                text: 'Asuntos Internos • Sistema de Alertas Automáticas',
                icon_url: botAvatar || undefined
            },
            timestamp: new Date().toISOString()
        };

        const payload = {
            username: botName,
            avatar_url: botAvatar || undefined,
            content: formattedPing ? `${formattedPing} 🔔 **Alerta de Prueba**` : undefined,
            allowed_mentions: {
                parse: ['roles', 'users', 'everyone']
            },
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson.message || JSON.stringify(errJson);
            } catch (e) {
                errText = `HTTP Error ${response.status} (${response.statusText})`;
            }
            return { success: false, error: errText };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

export async function sendIAComplaintNotificationToDiscord(complaintData) {
    try {
        const config = await getDiscordIAComplaintsWebhookConfig();
        if (!config.enabled || !config.webhookUrl || !config.webhookUrl.trim().startsWith('http')) {
            // Disabled or not configured
            return { success: false, skipped: true };
        }

        const targetUrl = config.webhookUrl.trim();
        const formattedPing = formatRoleMention(config.rolePing);
        const botName = (config.botName || '').trim() || DEFAULT_IA_COMPLAINTS_BOT_NAME;
        const botAvatar = (config.botAvatar || '').trim() || IA_LOGO_URL;

        const customMsg = config.customMsg || DEFAULT_IA_COMPLAINTS_CUSTOM_MSG;

        // Truncate declaration to prevent Discord 1024 char limits per field
        const declaracionText = complaintData.declaracion 
            ? (complaintData.declaracion.length > 900 
                ? complaintData.declaracion.substring(0, 900) + '... *(continúa en BBDD)*' 
                : complaintData.declaracion)
            : 'Sin declaración escrita.';

        const fields = [
            {
                name: '👤 Denunciante',
                value: `**${complaintData.denunciante_nombre || 'Anónimo'}**\n📞 ${complaintData.denunciante_telefono || 'No indicado'}`,
                inline: true
            },
            {
                name: '🎯 Denunciado / Agente',
                value: `**${complaintData.denunciado_nombre_placa || 'No especificado'}**`,
                inline: true
            },
            {
                name: '📅 Fecha de los Hechos',
                value: `${complaintData.fecha_hechos || 'No indicada'}`,
                inline: true
            },
            {
                name: '⚖️ Motivo de la Denuncia',
                value: `\`${complaintData.motivo || 'General'}\``,
                inline: false
            },
            {
                name: '📝 Declaración de los Hechos',
                value: declaracionText,
                inline: false
            }
        ];

        if (complaintData.pruebas) {
            const pruebasText = complaintData.pruebas.length > 900
                ? complaintData.pruebas.substring(0, 900) + '...'
                : complaintData.pruebas;
            fields.push({
                name: '📎 Pruebas y Enlaces Adjuntos',
                value: pruebasText,
                inline: false
            });
        }

        fields.push({
            name: '🚨 Acción Requerida',
            value: '👉 **Revisar en el Receptor de Denuncias de la BBDD y asignar caso de investigación.**',
            inline: false
        });

        const embed = {
            title: '⚖️ NUEVA DENUNCIA REGISTRADA (ASUNTOS INTERNOS)',
            description: customMsg,
            color: 0xDC2626, // Red / Crimson alert
            fields: fields,
            footer: {
                text: 'Asuntos Internos • Receptor de Denuncias',
                icon_url: botAvatar || undefined
            },
            timestamp: new Date().toISOString()
        };

        // Extract image URL from pruebas if any to show thumbnail/image
        if (complaintData.pruebas && typeof complaintData.pruebas === 'string') {
            const matchHttp = complaintData.pruebas.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp|gif))/i);
            if (matchHttp && matchHttp[1]) {
                embed.image = { url: matchHttp[1] };
            }
        }

        let messageContent = undefined;
        if (formattedPing) {
            messageContent = `${formattedPing} 🚨 **Nueva Denuncia Recibida**`;
        }

        const payload = {
            username: botName,
            avatar_url: botAvatar || undefined,
            content: messageContent,
            allowed_mentions: {
                parse: ['roles', 'users', 'everyone']
            },
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson.message || JSON.stringify(errJson);
            } catch (e) {
                errText = `HTTP Error ${response.status} (${response.statusText})`;
            }
            console.error('Failed to send IA Complaint notification to Discord:', errText);
            return { success: false, error: errText };
        }

        return { success: true };
    } catch (err) {
        console.error('Error in sendIAComplaintNotificationToDiscord:', err);
        return { success: false, error: err.message };
    }
}

// ==============================================================================
// 8. SCUB / GENERAL CRIMES COMPLAINTS NOTIFICATIONS WEBHOOK
// ==============================================================================

const LOCAL_STORAGE_KEY_SCUB_COMPLAINTS = 'discord_scub_complaints_webhook_cfg_v1';
export const DEFAULT_SCUB_COMPLAINTS_BOT_NAME = 'SCUB • Registro de Denuncias';
export const DEFAULT_SCUB_COMPLAINTS_CUSTOM_MSG = '📜 **Nueva Denuncia Ciudadana Registrada (SCUB)**. Se ha recibido una nueva denuncia en el sistema. Revisad el registro para iniciar la investigación y asignar detectives.';

export async function getDiscordSCUBComplaintsWebhookConfig() {
    try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY_SCUB_COMPLAINTS);
        let config = null;
        if (cached) {
            try { config = JSON.parse(cached); } catch (e) { /* ignore */ }
        }

        const { data, error } = await supabase.rpc('get_discord_scub_complaints_webhook_config');
        if (!error && data) {
            const freshConfig = {
                webhookUrl: data.webhook_url || '',
                enabled: !!data.enabled,
                rolePing: data.role_ping || '',
                botName: data.bot_name || DEFAULT_SCUB_COMPLAINTS_BOT_NAME,
                botAvatar: data.bot_avatar || '',
                customMsg: data.custom_msg || DEFAULT_SCUB_COMPLAINTS_CUSTOM_MSG
            };
            localStorage.setItem(LOCAL_STORAGE_KEY_SCUB_COMPLAINTS, JSON.stringify(freshConfig));
            return freshConfig;
        }

        if (config) return config;

        // Fallback to direct app_settings query
        const { data: directData } = await supabase
            .from('app_settings')
            .select('key, value')
            .in('key', [
                'discord_scub_complaints_webhook_url',
                'discord_scub_complaints_webhook_enabled',
                'discord_scub_complaints_webhook_role_ping',
                'discord_scub_complaints_webhook_bot_name',
                'discord_scub_complaints_webhook_bot_avatar',
                'discord_scub_complaints_webhook_custom_msg'
            ]);

        if (directData && directData.length > 0) {
            const map = {};
            directData.forEach(r => { map[r.key] = r.value; });
            const directConfig = {
                webhookUrl: map['discord_scub_complaints_webhook_url'] || '',
                enabled: map['discord_scub_complaints_webhook_enabled'] === 'true',
                rolePing: map['discord_scub_complaints_webhook_role_ping'] || '',
                botName: map['discord_scub_complaints_webhook_bot_name'] || DEFAULT_SCUB_COMPLAINTS_BOT_NAME,
                botAvatar: map['discord_scub_complaints_webhook_bot_avatar'] || '',
                customMsg: map['discord_scub_complaints_webhook_custom_msg'] || DEFAULT_SCUB_COMPLAINTS_CUSTOM_MSG
            };
            localStorage.setItem(LOCAL_STORAGE_KEY_SCUB_COMPLAINTS, JSON.stringify(directConfig));
            return directConfig;
        }

        return {
            webhookUrl: '',
            enabled: false,
            rolePing: '',
            botName: DEFAULT_SCUB_COMPLAINTS_BOT_NAME,
            botAvatar: '',
            customMsg: DEFAULT_SCUB_COMPLAINTS_CUSTOM_MSG
        };
    } catch (err) {
        console.error('Error in getDiscordSCUBComplaintsWebhookConfig:', err);
        return {
            webhookUrl: '',
            enabled: false,
            rolePing: '',
            botName: DEFAULT_SCUB_COMPLAINTS_BOT_NAME,
            botAvatar: '',
            customMsg: DEFAULT_SCUB_COMPLAINTS_CUSTOM_MSG
        };
    }
}

export async function saveDiscordSCUBComplaintsWebhookConfig(config) {
    try {
        const { data, error } = await supabase.rpc('save_discord_scub_complaints_webhook_config', {
            p_webhook_url: config.webhookUrl || '',
            p_enabled: !!config.enabled,
            p_role_ping: config.rolePing || '',
            p_bot_name: config.botName || DEFAULT_SCUB_COMPLAINTS_BOT_NAME,
            p_bot_avatar: config.botAvatar || '',
            p_custom_msg: config.customMsg || DEFAULT_SCUB_COMPLAINTS_CUSTOM_MSG
        });

        if (error) {
            // Direct app_settings fallback
            const updates = [
                { key: 'discord_scub_complaints_webhook_url', value: config.webhookUrl || '' },
                { key: 'discord_scub_complaints_webhook_enabled', value: config.enabled ? 'true' : 'false' },
                { key: 'discord_scub_complaints_webhook_role_ping', value: config.rolePing || '' },
                { key: 'discord_scub_complaints_webhook_bot_name', value: config.botName || DEFAULT_SCUB_COMPLAINTS_BOT_NAME },
                { key: 'discord_scub_complaints_webhook_bot_avatar', value: config.botAvatar || '' },
                { key: 'discord_scub_complaints_webhook_custom_msg', value: config.customMsg || DEFAULT_SCUB_COMPLAINTS_CUSTOM_MSG }
            ];
            const { error: directError } = await supabase.from('app_settings').upsert(updates);
            if (directError) throw directError;
        }

        localStorage.setItem(LOCAL_STORAGE_KEY_SCUB_COMPLAINTS, JSON.stringify({
            webhookUrl: config.webhookUrl || '',
            enabled: !!config.enabled,
            rolePing: config.rolePing || '',
            botName: config.botName || DEFAULT_SCUB_COMPLAINTS_BOT_NAME,
            botAvatar: config.botAvatar || '',
            customMsg: config.customMsg || DEFAULT_SCUB_COMPLAINTS_CUSTOM_MSG
        }));

        return { success: true };
    } catch (err) {
        console.error('Error saving SCUB Complaints Webhook config:', err);
        return { success: false, error: err.message };
    }
}

export async function testSCUBComplaintsDiscordWebhook(config) {
    try {
        if (!config?.webhookUrl || !config.webhookUrl.trim().startsWith('http')) {
            throw new Error('La URL del Webhook de Discord no es válida.');
        }

        const targetUrl = config.webhookUrl.trim();
        const formattedPing = formatRoleMention(config.rolePing);
        const botName = (config.botName || '').trim() || DEFAULT_SCUB_COMPLAINTS_BOT_NAME;
        const botAvatar = (config.botAvatar || '').trim() || SCUB_LOGO_URL;

        const embed = {
            title: '📜 PRUEBA DE CONEXIÓN: REGISTRO DE DENUNCIAS SCUB',
            description: '✅ **Webhook configurado correctamente.**\nLas denuncias ciudadanas recibidas desde el formulario externo se notificarán automáticamente en este canal.',
            color: 0xF59E0B, // Amber / Gold
            fields: [
                { name: '📋 Título de Prueba', value: 'Robo a Mano Armada en Little Seoul', inline: true },
                { name: '⚖️ Delito / Motivo', value: 'Robo con Violencia / Amenazas', inline: true },
                { name: '👤 Denunciante', value: 'Michael De Santa (📞 555-0143)', inline: true },
                { name: '🎯 Sospechosos', value: '2 Sujetos encapuchados en Karin Sultan negro', inline: true },
                { name: '📂 Estado en BBDD', value: '📥 **Abierta (Sin Caso Asignado)**', inline: false }
            ],
            footer: {
                text: 'SCUB • Registro de Denuncias • Alertas Automáticas',
                icon_url: botAvatar || undefined
            },
            timestamp: new Date().toISOString()
        };

        const payload = {
            username: botName,
            avatar_url: botAvatar || undefined,
            content: formattedPing ? `${formattedPing} 🔔 **Prueba de Conexión de Denuncias**` : undefined,
            allowed_mentions: {
                parse: ['roles', 'users', 'everyone']
            },
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson.message || JSON.stringify(errJson);
            } catch (e) {
                errText = `HTTP Error ${response.status} (${response.statusText})`;
            }
            return { success: false, error: errText };
        }

        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

export async function sendSCUBComplaintNotificationToDiscord(complaintData) {
    try {
        const config = await getDiscordSCUBComplaintsWebhookConfig();
        if (!config.enabled || !config.webhookUrl || !config.webhookUrl.trim().startsWith('http')) {
            // Disabled or not configured
            return { success: false, skipped: true };
        }

        const targetUrl = config.webhookUrl.trim();
        const formattedPing = formatRoleMention(config.rolePing);
        const botName = (config.botName || '').trim() || DEFAULT_SCUB_COMPLAINTS_BOT_NAME;
        const botAvatar = (config.botAvatar || '').trim() || SCUB_LOGO_URL;
        const customMsg = config.customMsg || DEFAULT_SCUB_COMPLAINTS_CUSTOM_MSG;

        // Format Complainants
        let complainantsText = 'No especificado';
        if (Array.isArray(complaintData.complainants) && complaintData.complainants.length > 0) {
            complainantsText = complaintData.complainants.map((c, i) => {
                const name = c.nombre_apellido || 'Anónimo';
                const tel = c.telefono ? `📞 ${c.telefono}` : '';
                const idDoc = c.id_documento ? `(ID: ${c.id_documento})` : '';
                return `• **${name}** ${tel} ${idDoc}`.trim();
            }).join('\n');
        }

        // Format Accused / Suspects
        let accusedText = 'Desconocido(s)';
        if (Array.isArray(complaintData.accused) && complaintData.accused.length > 0) {
            accusedText = complaintData.accused.map((a, i) => {
                const name = a.nombre_apellido && a.nombre_apellido !== 'N/A' ? a.nombre_apellido : 'Sujeto sin identificar';
                const rasgos = a.rasgos_fisicos && a.rasgos_fisicos !== 'N/A' ? `\n  - *Rasgos:* ${a.rasgos_fisicos}` : '';
                const tel = a.telefono && a.telefono !== 'N/A' ? `\n  - *Tel:* ${a.telefono}` : '';
                const doc = a.id_documento && a.id_documento !== 'N/A' ? `\n  - *ID:* ${a.id_documento}` : '';
                const instapic = a.instapic && a.instapic !== 'N/A' ? `\n  - *Instapic / Red:* ${a.instapic}` : '';
                return `• **${name}**${rasgos}${tel}${doc}${instapic}`;
            }).join('\n');
        }

        // Clean HTML in acontecimientos
        const cleanAcontecimientos = formatHtmlToDiscordMarkdown(complaintData.acontecimientos || '');
        const acontecimientosText = cleanAcontecimientos 
            ? (cleanAcontecimientos.length > 850 
                ? cleanAcontecimientos.substring(0, 850) + '... *(continúa en BBDD)*' 
                : cleanAcontecimientos)
            : 'Sin relato detallado.';

        const fields = [
            {
                name: '📋 Asunto / Título',
                value: `**${complaintData.titulo || 'Denuncia Ciudadana'}**`,
                inline: true
            },
            {
                name: '⚖️ Motivo / Delito',
                value: `\`${complaintData.motivo || 'General'}\``,
                inline: true
            },
            {
                name: '👤 Denunciante(s)',
                value: complainantsText,
                inline: false
            },
            {
                name: '🎯 Sospechoso(s) / Denunciado(s)',
                value: accusedText,
                inline: false
            },
            {
                name: '📝 Declaración / Acontecimientos',
                value: acontecimientosText,
                inline: false
            }
        ];

        if (complaintData.solicitud) {
            fields.push({
                name: '⚖️ Solicitud de la Víctima',
                value: complaintData.solicitud,
                inline: false
            });
        }

        fields.push({
            name: '🚨 Acción Requerida',
            value: '👉 **Acceder al Registro de Denuncias de la SCUB para revisar y vincular con expediente o investigación.**',
            inline: false
        });

        const embed = {
            title: '📜 NUEVA DENUNCIA CIUDADANA REGISTRADA (SCUB / DB)',
            description: customMsg,
            color: 0xF59E0B, // Amber / Gold
            fields: fields,
            footer: {
                text: 'SCUB • General Crimes Division • Registro de Denuncias',
                icon_url: botAvatar || undefined
            },
            timestamp: new Date().toISOString()
        };

        if (complaintData.image_url && typeof complaintData.image_url === 'string' && complaintData.image_url.startsWith('http')) {
            embed.image = { url: complaintData.image_url };
        }

        let messageContent = undefined;
        if (formattedPing) {
            messageContent = `${formattedPing} 🚨 **Nueva Denuncia Ciudadana Recibida**`;
        }

        const payload = {
            username: botName,
            avatar_url: botAvatar || undefined,
            content: messageContent,
            allowed_mentions: {
                parse: ['roles', 'users', 'everyone']
            },
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errText = '';
            try {
                const errJson = await response.json();
                errText = errJson.message || JSON.stringify(errJson);
            } catch (e) {
                errText = `HTTP Error ${response.status} (${response.statusText})`;
            }
            console.error('Failed to send SCUB Complaint notification to Discord:', errText);
            return { success: false, error: errText };
        }

        return { success: true };
    } catch (err) {
        console.error('Error in sendSCUBComplaintNotificationToDiscord:', err);
        return { success: false, error: err.message };
    }
}





