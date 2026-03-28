#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# setup.sh — Inicialización rápida para Claude Code
# ═══════════════════════════════════════════════════════════════
# Uso: ./setup.sh
# Después: claude   (para abrir Claude Code en este proyecto)
# ═══════════════════════════════════════════════════════════════

set -e

echo ""
echo "🏛️  RomainGE — Setup para Claude Code"
echo "═══════════════════════════════════════"
echo ""

# 1. Git init si no existe
if [ ! -d ".git" ]; then
  echo "📦 Inicializando repositorio git..."
  git init
  echo ""
fi

# 2. Instalar dependencias backend
echo "📦 Instalando dependencias del backend..."
cd backend
npm install
cd ..
echo ""

# 3. Instalar dependencias frontend
echo "📦 Instalando dependencias del frontend..."
cd frontend
npm install
cd ..
echo ""

# 4. Instalar concurrently para monorepo
echo "📦 Instalando dependencias raíz..."
npm install
echo ""

# 5. Crear .env si no existe
if [ ! -f "backend/.env" ]; then
  echo "📋 Creando backend/.env desde template..."
  cp backend/.env.example backend/.env
  echo "   ⚠️  IMPORTANTE: Edita backend/.env con tus claves API"
  echo ""
fi

# 6. Verificar Node.js
NODE_VERSION=$(node -v 2>/dev/null || echo "none")
echo "🔍 Node.js: $NODE_VERSION"
if [[ "$NODE_VERSION" == "none" ]]; then
  echo "   ❌ Node.js no encontrado. Instala Node.js 20+"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════"
echo "✅ Setup completado!"
echo ""
echo "Próximos pasos:"
echo ""
echo "  1. Edita backend/.env con tus API keys:"
echo "     - ANTHROPIC_API_KEY  (console.anthropic.com)"
echo "     - TWILIO_ACCOUNT_SID (twilio.com)"
echo "     - TWILIO_AUTH_TOKEN"
echo "     - TWILIO_PHONE_NUMBER"
echo ""
echo "  2. Arranca el desarrollo:"
echo "     npm run dev"
echo ""
echo "  3. Abre Claude Code para iterar:"
echo "     claude"
echo ""
echo "  4. Prueba ejemplos con Claude Code:"
echo "     claude 'añade un nuevo agente para IBI'"
echo "     claude 'mejora el simulador de renta con deducciones autonómicas'"
echo "     claude 'conecta Redis para las sesiones'"
echo "     claude 'añade tests con vitest'"
echo ""
