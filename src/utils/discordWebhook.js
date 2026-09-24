import { supabase } from '../supabaseClient';

const LOCAL_STORAGE_KEY = 'discord_announcements_webhook_cfg_v1';

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
    try {
        // Try calling RPC first
        const { data, error } = await supabase.rpc('get_discord_webhook_config');
        if (!error && data) {
            const config = {
                webhookUrl: data.webhook_url || '',
                enabled: !!data.enabled,
                rolePing: data.role_ping || ''
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
                'discord_announcements_webhook_role_ping'
            ]);

        if (!tableError && rows && rows.length > 0) {
            const configMap = {};
            rows.forEach(r => { configMap[r.key] = r.value; });

            const config = {
                webhookUrl: configMap['discord_announcements_webhook_url'] || '',
                enabled: configMap['discord_announcements_webhook_enabled'] === 'true',
                rolePing: configMap['discord_announcements_webhook_role_ping'] || ''
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
            return JSON.parse(cached);
        }
    } catch (e) {
        // ignore
    }

    return {
        webhookUrl: '',
        enabled: false,
        rolePing: ''
    };
}

/**
 * Save Discord Webhook settings
 */
export async function saveDiscordWebhookConfig({ webhookUrl, enabled, rolePing }) {
    const cleanUrl = (webhookUrl || '').trim();
    const cleanPing = (rolePing || '').trim();
    const isEnabled = Boolean(enabled);

    try {
        // Try RPC
        const { data, error } = await supabase.rpc('save_discord_webhook_config', {
            p_webhook_url: cleanUrl,
            p_enabled: isEnabled,
            p_role_ping: cleanPing
        });

        if (error) {
            // If RPC failed (e.g. not created yet), fallback to direct upsert in app_settings
            await supabase.from('app_settings').upsert([
                { key: 'discord_announcements_webhook_url', value: cleanUrl, updated_at: new Date().toISOString() },
                { key: 'discord_announcements_webhook_enabled', value: isEnabled ? 'true' : 'false', updated_at: new Date().toISOString() },
                { key: 'discord_announcements_webhook_role_ping', value: cleanPing, updated_at: new Date().toISOString() }
            ]);
        }

        const newConfig = {
            webhookUrl: cleanUrl,
            enabled: isEnabled,
            rolePing: cleanPing
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
export async function testDiscordWebhook(webhookUrl, rolePing = '') {
    if (!webhookUrl || !webhookUrl.trim().startsWith('https://')) {
        throw new Error('La URL del webhook debe ser una URL válida que comience con https://');
    }

    const payload = {
        username: 'Detective Bureau • Sistema de Alertas',
        avatar_url: 'https://i.postimg.cc/mD8V4y2N/lspd-badge.png',
        content: rolePing ? `${rolePing} 🔔 **Notificación de Prueba de Coordinación**` : undefined,
        embeds: [
            {
                title: '🧪 Prueba de Conexión de Webhook Exitosa',
                description: 'Este es un mensaje de prueba enviado desde el **Panel de Coordinación del Detective Bureau**.\n\nEl sistema de webhooks está correctamente configurado y listo para retransmitir los comunicados y avisos oficiales que se publiquen en el Dashboard.',
                color: 0x10B981, // Verde esmeralda
                fields: [
                    {
                        name: '📊 Estado',
                        value: '✅ Conexión establecida y verificada',
                        inline: true
                    },
                    {
                        name: '⚡ Notificaciones automáticas',
                        value: 'Activadas para nuevos anuncios',
                        inline: true
                    },
                    {
                        name: '🎯 Destino de mención',
                        value: rolePing ? `\`${rolePing}\`` : '*Sin mención de rol*',
                        inline: false
                    }
                ],
                footer: {
                    text: 'Detective Bureau • Panel de Coordinación & Jefatura'
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
        const maxDescLength = 3900;
        const finalDescription = cleanMarkdown.length > maxDescLength
            ? cleanMarkdown.substring(0, maxDescLength) + '\n\n*... [Texto truncado por longitud. Ver anuncio completo en el Dashboard]*'
            : cleanMarkdown;

        const authorName = [author?.nombre, author?.apellido].filter(Boolean).join(' ') || 'Detective Bureau Staff';
        const authorRank = author?.rango ? `[${author.rango}]` : '';
        const authorFull = `${authorRank} ${authorName}`.trim();

        const embedColor = pinned ? 0xF59E0B : 0x3B82F6; // Ámbar / Dorado si está fijado, Azul si es estándar
        const embedTitle = pinned ? `📌 [COMUNICADO OFICIAL FIJADO] ${title}` : `📢 ${title}`;

        const embed = {
            title: embedTitle,
            description: finalDescription || '*Sin descripción escrita*',
            color: embedColor,
            author: {
                name: authorFull || 'Personal de Coordinación / Detective Bureau',
                icon_url: author?.profile_image || author?.avatar_url || undefined
            },
            footer: {
                text: 'Detective Bureau • Portal de Anuncios del Dashboard'
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
            messageContent = `${config.rolePing.trim()} 📢 **Nuevo Anuncio publicado en el Dashboard**`;
        }

        const payload = {
            username: 'Detective Bureau • Dashboard Announcements',
            avatar_url: 'https://i.postimg.cc/mD8V4y2N/lspd-badge.png',
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
