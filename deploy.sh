#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# deploy.sh — Despliegue completo de RomainGE
# ═══════════════════════════════════════════════════════════════
# Uso: ./deploy.sh [setup|backend|frontend|all]
# ═══════════════════════════════════════════════════════════════

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════╗"
echo "║  🏛️  RomainGE — Despliegue Automático            ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"

case "${1:-all}" in

  setup)
    echo -e "${GREEN}📦 Instalando dependencias...${NC}"
    cd backend && npm install
    cd ../frontend && npm install
    cd ..

    echo -e "${GREEN}📋 Verificando variables de entorno...${NC}"
    if [ ! -f backend/.env ]; then
      cp backend/.env.example backend/.env
      echo -e "${RED}⚠️  Archivo .env creado. Edítalo con tus claves antes de desplegar:${NC}"
      echo "   nano backend/.env"
      exit 1
    fi

    echo -e "${GREEN}📞 Configurando Twilio...${NC}"
    cd backend && node scripts/setup-twilio.js
    cd ..

    echo -e "${GREEN}✅ Setup completado${NC}"
    ;;

  backend)
    echo -e "${GREEN}🚀 Desplegando backend...${NC}"
    cd backend

    # Verificar Vercel CLI
    if ! command -v vercel &> /dev/null; then
      echo "Instalando Vercel CLI..."
      npm i -g vercel
    fi

    vercel --prod
    echo -e "${GREEN}✅ Backend desplegado${NC}"
    ;;

  frontend)
    echo -e "${GREEN}🚀 Desplegando frontend...${NC}"
    cd frontend
    npm run build

    if ! command -v vercel &> /dev/null; then
      npm i -g vercel
    fi

    vercel --prod
    echo -e "${GREEN}✅ Frontend desplegado${NC}"
    ;;

  railway)
    echo -e "${GREEN}🚀 Desplegando backend en Railway...${NC}"
    echo "  Railway soporta WebSockets nativamente (mejor que Vercel)."
    echo ""

    # Check if railway CLI is installed
    if command -v railway &> /dev/null; then
      echo -e "${GREEN}✅ Railway CLI detectado${NC}"
      echo ""
      echo "  Desplegando con Railway CLI..."
      cd backend
      railway up --detach
      cd ..
      echo ""
      echo -e "${GREEN}✅ Despliegue iniciado en Railway${NC}"
    else
      echo -e "${CYAN}📦 Railway CLI no encontrado. Instalando...${NC}"
      echo "  npm i -g @railway/cli"
      echo "  railway login"
      echo ""
      echo "  O despliega manualmente:"
    fi

    echo ""
    echo -e "${CYAN}═══ Configuración Railway ═══${NC}"
    echo ""
    echo "  1. railway init (o New Project en railway.app)"
    echo "  2. Configura Root Directory: /backend"
    echo "  3. Railway detecta Node.js automáticamente (Procfile incluido)"
    echo ""
    echo "  Variables de entorno necesarias (railway variables set):"
    echo "  ─────────────────────────────────────────────────────"
    echo "  ANTHROPIC_API_KEY     — Tu clave Claude API"
    echo "  TWILIO_ACCOUNT_SID   — SID de tu cuenta Twilio"
    echo "  TWILIO_AUTH_TOKEN    — Token de autenticación Twilio"
    echo "  TWILIO_PHONE_NUMBER  — Número de teléfono Twilio"
    echo "  BASE_URL             — URL pública del backend (ej: https://romainge-backend.up.railway.app)"
    echo "  API_SECRET           — Secreto para API (min 32 chars)"
    echo "  JWT_SECRET           — Secreto para tokens JWT (min 64 chars)"
    echo "  NODE_ENV=production"
    echo ""
    echo "  Redis (sesiones escalables):"
    echo "  ─────────────────────────────────────────────────────"
    echo "  → Railway Dashboard → Add Plugin → Redis"
    echo "  → Railway inyecta REDIS_URL automáticamente"
    echo "  → El backend detecta REDIS_URL y usa Redis automáticamente"
    echo "  → No hace falta cambiar código: sessions-adapter.js lo gestiona"
    echo ""
    echo "  Verificar despliegue:"
    echo "  → curl https://<tu-dominio>.up.railway.app/api/health"
    ;;

  all)
    echo -e "${GREEN}🚀 Despliegue completo...${NC}"
    $0 setup
    $0 backend
    $0 frontend
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ ¡Despliegue completo!${NC}"
    echo ""
    echo "  🌐 Frontend: https://romainge.com"
    echo "  🔌 Backend:  https://api.romainge.com"
    echo "  📞 Teléfono: Configurado en Twilio"
    echo ""
    echo "  Próximos pasos:"
    echo "  1. Verificar webhooks Twilio → https://api.romainge.com/api/voice/incoming"
    echo "  2. Hacer llamada de prueba al número"
    echo "  3. Probar login de sesión en romainge.com"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    ;;

  *)
    echo "Uso: ./deploy.sh [setup|backend|frontend|railway|all]"
    exit 1
    ;;
esac
