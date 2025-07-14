# 🧠 AI Mental Wellbeing Agent Team

Un sistema inteligente de salud mental que utiliza múltiples agentes de IA especializados para generar planes personalizados de bienestar mental a través de Telegram.

## 🌟 Características

- **🤖 3 Agentes Especializados**: Assessment, Action Plan, y Follow-up Strategy
- **📱 Bot de Telegram**: Interfaz amigable para usuarios
- **🧠 IA Avanzada**: Utiliza GPT-4 para análisis personalizado
- **⚡ Respuesta Rápida**: Generación de planes en segundos
- **🔒 Seguro**: Validación de datos y manejo de errores robusto
- **📊 Logging Completo**: Monitoreo detallado de todas las operaciones

## 🏗️ Arquitectura

```
Usuario → Telegram Bot → API → AgentCoordinator → 3 Agentes Especializados
```

### Agentes del Sistema:

1. **🧠 AssessmentAgent**: Evalúa el estado mental y emocional
2. **⚡ ActionAgent**: Genera planes de acción inmediatos
3. **🔄 FollowUpAgent**: Diseña estrategias a largo plazo

## 🚀 Instalación

### Prerrequisitos

- Node.js >= 18.0.0
- npm o yarn
- Cuenta de OpenAI con API key
- Bot de Telegram (opcional para desarrollo)

### Pasos de Instalación

1. **Clonar el repositorio**
```bash
git clone <tu-repositorio-url>
cd ai_mental_wellbeing_agent_team
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp env.example .env
```

Editar `.env` con tus credenciales:
```bash
# OpenAI Configuration
OPENAI_API_KEY=tu_openai_api_key_aqui
OPENAI_MODEL=gpt-4o

# Telegram Bot Configuration (opcional)
TELEGRAM_BOT_TOKEN=tu_telegram_bot_token_aqui
API_BASE_URL=http://localhost:3000
```

4. **Compilar el proyecto**
```bash
npm run build
```

## 🎯 Uso

### Ejecutar la API

```bash
# Modo desarrollo
npm run dev

# Modo producción
npm start
```

### Ejecutar el Bot de Telegram

```bash
# En otra terminal
npm run bot

# Modo desarrollo con auto-reload
npm run bot:dev
```

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Tests en modo watch
npm run test:watch
```

## 📱 Cómo Usar el Bot

1. **Abrir Telegram** y buscar tu bot
2. **Enviar `/start`** para comenzar
3. **Proporcionar información** en este formato:
```
Estado: ansioso
Sueño: 6
Estrés: 7
Apoyo: familia, amigos
Síntomas: insomnio, preocupación
```
4. **Recibir plan personalizado** de salud mental

## 🔧 API Endpoints

### Health Check
```bash
GET /health
```

### Agent Status
```bash
GET /agents/status
```

### Generate Mental Health Plan
```bash
POST /api/mental-health-plan
Content-Type: application/json

{
  "mentalState": "ansioso",
  "sleepPattern": 6,
  "stressLevel": 7,
  "supportSystem": ["familia", "amigos"],
  "currentSymptoms": ["insomnio", "preocupación"]
}
```

## 🏗️ Estructura del Proyecto

```
ai_mental_wellbeing_agent_team/
├── src/
│   ├── agents/           # Agentes especializados
│   │   ├── assessment-agent.ts
│   │   ├── action-agent.ts
│   │   ├── followup-agent.ts
│   │   └── base-agent.ts
│   ├── services/         # Servicios de coordinación
│   │   ├── agent-coordinator.service.ts
│   │   └── openai.service.ts
│   ├── types/           # Definiciones de tipos
│   ├── utils/           # Utilidades
│   └── index.ts         # Punto de entrada
├── tests/               # Tests unitarios e integración
├── telegram-bot.js      # Bot de Telegram
├── package.json
└── README.md
```

## 🧪 Testing

El proyecto incluye tests completos:

- **Unit Tests**: Para cada agente y servicio
- **Integration Tests**: Para la API completa
- **Simple Tests**: Para validación de esquemas

```bash
npm test
```

## 📊 Monitoreo y Logs

Los logs se guardan en la carpeta `logs/`:
- `combined.log`: Todos los logs
- `error.log`: Solo errores
- `exceptions.log`: Excepciones
- `rejections.log`: Promesas rechazadas

## 🔒 Seguridad

- Validación de entrada con Zod
- Rate limiting configurable
- Manejo seguro de errores
- Logs sin información sensible
- Disclaimer médico en respuestas

## 🚨 Consideraciones Médicas

**⚠️ IMPORTANTE**: Este es un asistente de IA para bienestar mental general. No reemplaza la atención médica profesional.

- Para emergencias de salud mental, contacta a un profesional
- Los planes generados son sugerencias, no diagnósticos médicos
- Siempre consulta con un profesional de la salud para problemas serios

## 🤝 Contribuir

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 🙏 Agradecimientos

- OpenAI por proporcionar la API de GPT-4
- La comunidad de TypeScript y Node.js
- Todos los contribuidores al proyecto

## 📞 Soporte

Si tienes preguntas o necesitas ayuda:

1. Revisa la documentación
2. Abre un issue en GitHub
3. Contacta al equipo de desarrollo

---

**Desarrollado con ❤️ para mejorar el bienestar mental**

