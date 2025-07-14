import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Configuración del bot
const token = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Crear instancia del bot
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Telegram Bot iniciado...');
console.log('📡 Conectando con API en:', API_BASE_URL);

// Estados de conversación para cada usuario
const userStates = new Map();

// Función para enviar mensaje de bienvenida
function sendWelcomeMessage(chatId) {
  const welcomeMessage = `
🧠 *Bienvenido al AI Mental Wellbeing Agent*

Soy tu asistente de salud mental. Para generar un plan personalizado, necesito que me proporciones la siguiente información:

*Estado Mental:* (ej: ansioso, deprimido, tranquilo)
*Horas de Sueño:* (1-12 horas)
*Nivel de Estrés:* (1-10, donde 10 es muy estresado)
*Sistema de Apoyo:* (ej: familia, amigos, terapeuta)
*Síntomas Actuales:* (ej: insomnio, preocupación, fatiga)

*Ejemplo de respuesta:*
\`\`\`
Estado: ansioso
Sueño: 6
Estrés: 7
Apoyo: familia, amigos
Síntomas: insomnio, preocupación
\`\`\`

Escribe tu información y te generaré un plan personalizado de salud mental.
  `;
  
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
}

// Función para parsear la información del usuario
function parseUserInput(text) {
  const lines = text.split('\n');
  const data = {};
  
  lines.forEach(line => {
    const [key, value] = line.split(':').map(s => s.trim());
    if (key && value) {
      switch (key.toLowerCase()) {
        case 'estado':
        case 'estado mental':
          data.mentalState = value;
          break;
        case 'sueño':
        case 'horas de sueño':
          data.sleepPattern = parseInt(value);
          break;
        case 'estrés':
        case 'nivel de estrés':
          data.stressLevel = parseInt(value);
          break;
        case 'apoyo':
        case 'sistema de apoyo':
          data.supportSystem = value.split(',').map(s => s.trim());
          break;
        case 'síntomas':
        case 'síntomas actuales':
          data.currentSymptoms = value.split(',').map(s => s.trim());
          break;
      }
    }
  });
  
  return data;
}

// Función para validar los datos
function validateData(data) {
  const errors = [];
  
  if (!data.mentalState) errors.push('Estado mental es requerido');
  if (!data.sleepPattern || data.sleepPattern < 1 || data.sleepPattern > 12) {
    errors.push('Horas de sueño debe ser entre 1 y 12');
  }
  if (!data.stressLevel || data.stressLevel < 1 || data.stressLevel > 10) {
    errors.push('Nivel de estrés debe ser entre 1 y 10');
  }
  if (!data.supportSystem || data.supportSystem.length === 0) {
    errors.push('Sistema de apoyo es requerido');
  }
  if (!data.currentSymptoms || data.currentSymptoms.length === 0) {
    errors.push('Síntomas actuales son requeridos');
  }
  
  return errors;
}

// Función para generar el plan de salud mental
async function generateMentalHealthPlan(data) {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/mental-health-plan`, data, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 segundos timeout
    });
    
    return response.data;
  } catch (error) {
    console.error('Error al generar plan:', error.response?.data || error.message);
    throw error;
  }
}

// Función para formatear la respuesta del plan
function formatPlanResponse(planData) {
  const plan = planData.data;
  
  let message = `🧠 *Tu Plan de Salud Mental*\n\n`;
  
  // Assessment
  message += `📊 *Evaluación:*\n`;
  message += `${plan.assessment.content}\n\n`;
  message += `*Nivel de Riesgo:* ${plan.assessment.riskLevel}\n`;
  message += `*Emociones Principales:* ${plan.assessment.emotionalAnalysis.primaryEmotions.join(', ')}\n\n`;
  
  // Action Plan
  message += `⚡ *Plan de Acción Inmediata:*\n`;
  message += `${plan.actionPlan.content}\n\n`;
  message += `*Urgencia:* ${plan.actionPlan.urgency}\n\n`;
  
  // Immediate Actions
  if (plan.actionPlan.immediateActions.length > 0) {
    message += `*Acciones Inmediatas:*\n`;
    plan.actionPlan.immediateActions.forEach((action, index) => {
      message += `${index + 1}. *${action.title}* (${action.priority})\n`;
      message += `   ${action.description}\n\n`;
    });
  }
  
  // Follow Up
  message += `🔄 *Estrategias a Largo Plazo:*\n`;
  message += `${plan.followUp.content}\n\n`;
  
  if (plan.followUp.longTermStrategies.length > 0) {
    plan.followUp.longTermStrategies.forEach((strategy, index) => {
      message += `*${strategy.category}* (${strategy.timeline}):\n`;
      strategy.strategies.forEach(s => message += `• ${s}\n`);
      message += `\n`;
    });
  }
  
  // Summary
  message += `📋 *Resumen:*\n`;
  message += `*Insights Clave:*\n`;
  plan.summary.keyInsights.forEach(insight => {
    message += `• ${insight}\n`;
  });
  message += `\n*Próximos Pasos:*\n`;
  plan.summary.immediateNextSteps.forEach(step => {
    message += `• ${step}\n`;
  });
  
  return message;
}

// Manejador de comandos
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  sendWelcomeMessage(chatId);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  sendWelcomeMessage(chatId);
});

// Manejador de mensajes de texto
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Ignorar comandos
  if (text.startsWith('/')) return;
  
  try {
    // Mostrar indicador de "escribiendo"
    bot.sendChatAction(chatId, 'typing');
    
    // Parsear la información del usuario
    const userData = parseUserInput(text);
    
    // Validar datos
    const errors = validateData(userData);
    if (errors.length > 0) {
      const errorMessage = `❌ *Errores en los datos:*\n${errors.map(e => `• ${e}`).join('\n')}\n\nPor favor, corrige los errores y envía la información nuevamente.`;
      bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
      return;
    }
    
    // Enviar mensaje de procesamiento
    const processingMsg = await bot.sendMessage(chatId, '🔄 *Generando tu plan de salud mental...*\n\nEsto puede tomar unos segundos.', { parse_mode: 'Markdown' });
    
    // Generar el plan
    const planData = await generateMentalHealthPlan(userData);
    
    // Formatear y enviar la respuesta
    const formattedResponse = formatPlanResponse(planData);
    
    // Dividir mensaje si es muy largo (límite de Telegram: 4096 caracteres)
    const maxLength = 4000;
    if (formattedResponse.length > maxLength) {
      const parts = [];
      let currentPart = '';
      
      formattedResponse.split('\n').forEach(line => {
        if ((currentPart + line + '\n').length > maxLength) {
          parts.push(currentPart);
          currentPart = line + '\n';
        } else {
          currentPart += line + '\n';
        }
      });
      parts.push(currentPart);
      
      // Eliminar mensaje de procesamiento
      bot.deleteMessage(chatId, processingMsg.message_id);
      
      // Enviar partes
      for (let i = 0; i < parts.length; i++) {
        await bot.sendMessage(chatId, parts[i], { parse_mode: 'Markdown' });
        if (i < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa entre mensajes
        }
      }
    } else {
      // Eliminar mensaje de procesamiento y enviar respuesta
      bot.deleteMessage(chatId, processingMsg.message_id);
      bot.sendMessage(chatId, formattedResponse, { parse_mode: 'Markdown' });
    }
    
    // Enviar mensaje de seguimiento
    const followUpMessage = `
💡 *¿Necesitas más ayuda?*

• Envía /start para generar un nuevo plan
• Envía /help para ver las instrucciones
• Los recursos recomendados están disponibles en los enlaces proporcionados

*Recuerda:* Este es un asistente de IA. Para emergencias de salud mental, contacta a un profesional de la salud.
    `;
    
    setTimeout(() => {
      bot.sendMessage(chatId, followUpMessage, { parse_mode: 'Markdown' });
    }, 2000);
    
  } catch (error) {
    console.error('Error en el bot:', error);
    
    let errorMessage = '❌ *Error al procesar tu solicitud*\n\n';
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage += 'No se pudo conectar con el servidor. Por favor, intenta más tarde.';
    } else if (error.response?.status === 400) {
      errorMessage += 'Los datos proporcionados no son válidos. Por favor, revisa la información y vuelve a intentar.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage += 'La solicitud tardó demasiado. Por favor, intenta nuevamente.';
    } else {
      errorMessage += 'Ocurrió un error inesperado. Por favor, intenta más tarde.';
    }
    
    bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
  }
});

// Manejador de errores
bot.on('error', (error) => {
  console.error('Error del bot:', error);
});

bot.on('polling_error', (error) => {
  console.error('Error de polling:', error);
});

console.log('✅ Bot listo para recibir mensajes');
console.log('📱 Envía /start a tu bot para comenzar'); 