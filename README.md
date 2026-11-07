# Animalista · Plataforma de firmas

Frontend (React + TypeScript + Vite) for collecting verified signatures.

| Ruta | Pantalla |
| --- | --- |
| `/` | Registro público y firma (datos → firma dibujada → código por correo → comprobante) |
| `/admin/acceso` | Acceso de administrador con 2FA (QR TOTP) |
| `/admin` | Dashboard de analítica (datos de muestra) |
| `/admin/eventos` | Configurar evento, con vista previa en vivo |

```bash
npm install
npm run dev
```

Notes:
- No backend yet: analytics use sample data (`src/data/sample.ts`), the QR is illustrative (`src/lib/qr.ts`), and the event configuration is saved to `localStorage` (`src/data/event.tsx`) so the public page picks up the colors and texts.
- Design tokens live in `src/styles/global.css`.
