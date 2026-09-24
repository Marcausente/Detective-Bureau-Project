import { supabase } from '../supabaseClient';

const LOCAL_STORAGE_KEY = 'discord_announcements_webhook_cfg_v2';

export const SCUB_LOGO_URL = 'https://znyleibiazxxmkbzrqqh.supabase.co/storage/v1/object/public/uploads/system/scub_logo.png';
export const DEFAULT_BOT_NAME = 'SCUB • Sheriff Criminal Unit Bureau';
export const DEFAULT_HEADER_TEXT = 'Nueva publicación en la BBDD de la SCUB';
export const DEFAULT_FOOTER_TEXT = 'SCUB • Sheriff Criminal Unit Bureau';
export const DEFAULT_REMINDER_TEXT = 'Confirmad lectura en la propia Base de Datos.';

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

/**
 * Fetch Discord Webhook settings from DB (or fallback to local cache)
 */
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
        // Try calling RPC first
        const { data, error } = await supabase.rpc('get_discord_webhook_config');
        if (!error && data) {
            const config = {
                webhookUrl: data.webhook_url || '',
                enabled: !!data.enabled,
                rolePing: data.role_ping || '',
                botName: data.bot_name || DEFAULT_BOT_NAME,
                botAvatar: data.bot_avatar || SCUB_LOGO_URL,
                footerText: data.footer_text || DEFAULT_FOOTER_TEXT,
                customHeader: data.custom_header || DEFAULT_HEADER_TEXT,
                reminderText: data.reminder_text !== undefined ? data.reminder_text : DEFAULT_REMINDER_TEXT
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
            } catch (e) {
                // ignore storage error
            }
            return config;
        }

        // Fallback: direct table query
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
                rolePing: configMap['discord_announcements_webhook_role_ping'] || '',
                botName: configMap['discord_announcements_bot_name'] || DEFAULT_BOT_NAME,
                botAvatar: configMap['discord_announcements_bot_avatar'] || SCUB_LOGO_URL,
                footerText: configMap['discord_announcements_footer_text'] || DEFAULT_FOOTER_TEXT,
                customHeader: configMap['discord_announcements_custom_header'] || DEFAULT_HEADER_TEXT,
                reminderText: configMap['discord_announcements_reminder_text'] !== undefined ? configMap['discord_announcements_reminder_text'] : DEFAULT_REMINDER_TEXT
            };
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
            } catch (e) {
                // ignore
            }
            return config;
        }
    } catch (err) {
        console.warn('Could not load discord webhook config from DB, checking local storage:', err);
    }

    // Fallback to localStorage
    try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
            return { ...defaultConfig, ...JSON.parse(cached) };
        }
    } catch (e) {
        // ignore
    }

    return defaultConfig;
}

/**
 * Save Discord Webhook settings
 */
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
    const cleanPing = (rolePing || '').trim();
    const isEnabled = Boolean(enabled);
    const cleanBotName = (botName || DEFAULT_BOT_NAME).trim();
    const cleanBotAvatar = (botAvatar || SCUB_LOGO_URL).trim();
    const cleanFooterText = (footerText || DEFAULT_FOOTER_TEXT).trim();
    const cleanHeader = (customHeader || DEFAULT_HEADER_TEXT).trim();
    const cleanReminder = (reminderText !== undefined ? reminderText : DEFAULT_REMINDER_TEXT).trim();

    try {
        // Try RPC
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
            // Fallback direct upserts
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
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newConfig));
        } catch (e) {
            // ignore
        }

        return { success: true, config: newConfig };
    } catch (err) {
        console.error('Error saving discord webhook config:', err);
        throw err;
    }
}

/**
 * Test sending a message to the provided Webhook URL
 */
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

    let contentMessage = undefined;
    if (rolePing && rolePing.trim()) {
        contentMessage = `${rolePing.trim()} 🔔 **Notificación de Prueba de Coordinación**\n*${header}*`;
    }

    const reminderMarkdown = reminder ? `\n\n*${reminder}*` : '';

    const payload = {
        username: name,
        avatar_url: avatar,
        content: contentMessage,
        embeds: [
            {
                title: '🧪 Prueba de Conexión de Webhook Exitosa',
                description: `Este es un mensaje de prueba enviado desde el **Panel de Coordinación** con los parámetros personalizados.\n\nEl sistema de webhooks está correctamente configurado y listo para retransmitir los comunicados y avisos oficiales que se publiquen en el Dashboard.${reminderMarkdown}`,
                color: 0x10B981, // Verde esmeralda
                fields: [
                    {
                        name: '📊 Estado',
                        value: '✅ Conexión establecida y verificada',
                        inline: true
                    },
                    {
                        name: '🤖 Nombre de Bot',
                        value: `\`${name}\``,
                        inline: true
                    },
                    {
                        name: '🎯 Destino de mención',
                        value: rolePing ? `\`${rolePing}\`` : '*Sin mención de rol*',
                        inline: false
                    }
                ],
                footer: {
                    text: footer,
                    icon_url: avatar
                },
                timestamp: new Date().toISOString()
            }
        ]
    };

    const response = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
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

/**
 * Send an announcement to Discord via Webhook
 */
export async function sendAnnouncementToDiscord({ title, content, pinned, images = [], author = {}, forceSend = false }) {
    try {
        const config = await getDiscordWebhookConfig();

        if (!forceSend) {
            if (!config.enabled) {
                console.log('Discord webhook disabled in settings, skipping notification.');
                return { skipped: true, reason: 'disabled' };
            }
            if (!config.webhookUrl || !config.webhookUrl.trim().startsWith('https://')) {
                console.log('No valid Discord webhook URL configured, skipping notification.');
                return { skipped: true, reason: 'no_url' };
            }
        }

        const targetUrl = config.webhookUrl.trim();
        if (!targetUrl.startsWith('https://')) {
            throw new Error('URL de webhook no válida');
        }

        const cleanMarkdown = formatHtmlToDiscordMarkdown(content);
        // Truncate to Discord limit (embed description is max 4096 chars)
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

        const embedColor = pinned ? 0xF59E0B : 0x3B82F6; // Ámbar si está fijado, Azul si es estándar
        const embedTitle = pinned ? `📌 [COMUNICADO OFICIAL FIJADO] ${title}` : `📢 ${title}`;

        const botAvatar = (config.botAvatar || '').trim() || SCUB_LOGO_URL;
        const botName = (config.botName || '').trim() || DEFAULT_BOT_NAME;
        const footerText = (config.footerText || '').trim() || DEFAULT_FOOTER_TEXT;
        const customHeader = (config.customHeader || '').trim() || DEFAULT_HEADER_TEXT;

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

        // Attach first image if available
        if (images && images.length > 0 && typeof images[0] === 'string' && images[0].startsWith('http')) {
            embed.image = {
                url: images[0]
            };
        }

        // If there are additional images, list them in a field or as links
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
        if (config.rolePing && config.rolePing.trim()) {
            messageContent = `${config.rolePing.trim()} 📢 **${customHeader}**`;
        }

        const payload = {
            username: botName,
            avatar_url: botAvatar,
            content: messageContent,
            embeds: [embed]
        };

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
