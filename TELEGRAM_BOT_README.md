# 🤖 Bot de Telegram - AI Mental Wellbeing Agent

Este bot de Telegram permite a los usuarios interactuar con el sistema de salud mental a través de mensajes de texto.

## 🚀 Configuración

### 1. Crear un Bot de Telegram

1. Abre Telegram y busca `@BotFather`
2. Envía `/newbot`
3. Sigue las instrucciones para crear tu bot
4. Guarda el token que te proporciona BotFather

### 2. Configurar Variables de Entorno

Agrega el token de tu bot al archivo `.env`:

```bash
TELEGRAM_BOT_TOKEN=tu_token_aqui
API_BASE_URL=http://localhost:3000
```

### 3. Ejecutar el Bot

```bash
# Ejecutar el bot
npm run bot

# Ejecutar en modo desarrollo (con auto-reload)
npm run bot:dev
```

## 📱 Cómo Usar el Bot

### Comandos Disponibles

- `/start` - Iniciar el bot y ver las instrucciones
- `/help` - Mostrar ayuda

### Formato de Entrada

El usuario debe proporcionar la información en el siguiente formato:

```
Estado: ansioso
Sueño: 6
Estrés: 7
Apoyo: familia, amigos
Síntomas: insomnio, preocupación
```

### Ejemplo de Interacción

1. **Usuario envía:** `/start`
2. **Bot responde:** Mensaje de bienvenida con instrucciones
3. **Usuario envía:** Información en el formato especificado
4. **Bot responde:** Plan de salud mental personalizado

## 🔧 Características

- ✅ Validación de datos de entrada
- ✅ Formateo automático de respuestas
- ✅ Manejo de mensajes largos (división automática)
- ✅ Indicadores de "escribiendo"
- ✅ Manejo de errores robusto
- ✅ Timeout configurable para requests
- ✅ Soporte para Markdown en mensajes

## 🛠️ Estructura del Código

- `telegram-bot.js` - Archivo principal del bot
- `parseUserInput()` - Parsea la entrada del usuario
- `validateData()` - Valida los datos de entrada
- `generateMentalHealthPlan()` - Conecta con la API
- `formatPlanResponse()` - Formatea la respuesta

## 🔍 Debugging

Para ver los logs del bot, ejecuta:

```bash
DEBUG=* npm run bot
```

## 📊 Monitoreo

El bot registra:
- Mensajes recibidos
- Errores de conexión
- Tiempo de respuesta
- Errores de validación

## 🚨 Consideraciones de Seguridad

- El token del bot debe mantenerse seguro
- Los mensajes se procesan localmente
- No se almacenan conversaciones
- Se recomienda usar HTTPS en producción

## 🔄 Flujo de Trabajo

1. **Usuario envía mensaje** → Bot recibe
2. **Parseo de datos** → Extrae información
3. **Validación** → Verifica formato y rangos
4. **Request a API** → Envía a tu servidor
5. **Formateo** → Convierte respuesta a texto
6. **Envío** → Devuelve plan al usuario

## 🎯 Próximos Pasos

- [ ] Agregar persistencia de conversaciones
- [ ] Implementar botones inline
- [ ] Agregar más comandos
- [ ] Integrar con base de datos
- [ ] Agregar analytics 