import { NavLink } from 'react-router-dom';
import { Building2, Fuel, Wallet, Receipt, LayoutDashboard, FileText, HandCoins, ChevronRight } from 'lucide-react';

const SUBMODULOS = [
  {
    title: 'Rendiciones de Combustible',
    description: 'Carga y seguimiento de rendiciones de combustible de los moviles.',
    icon: Fuel,
    path: '/rendiciones-combustible',
    color: 'text-cbvp-orange',
    bg: 'bg-cbvp-orange/8',
    border: 'border-cbvp-orange/15 hover:border-cbvp-orange/30',
  },
  {
    title: 'Cuotas de Bomberos',
    description: 'Control de cuotas societarias al dia por bombero.',
    icon: Wallet,
    path: '/cuotas-bomberos',
    color: 'text-cbvp-yellow',
    bg: 'bg-cbvp-yellow/8',
    border: 'border-cbvp-yellow/15 hover:border-cbvp-yellow/30',
  },
  {
    title: 'Ordenes de Pago',
    description: 'Emision y seguimiento de ordenes de pago de la compania.',
    icon: Receipt,
    path: '/ordenes-pago',
    color: 'text-cbvp-red',
    bg: 'bg-cbvp-red/8',
    border: 'border-cbvp-red/15 hover:border-cbvp-red/30',
  },
  {
    title: 'Resumen Financiero',
    description: 'Caja Chica y Cuentas en Entidades combinadas en una sola vista.',
    icon: LayoutDashboard,
    path: '/resumen-financiero',
    color: 'text-cbvp-blue',
    bg: 'bg-cbvp-blue/8',
    border: 'border-cbvp-blue/15 hover:border-cbvp-blue/30',
  },
  {
    title: 'Facturas de Gastos',
    description: 'Registro de facturas pagadas desde Caja Chica u Ordenes de Pago.',
    icon: FileText,
    path: '/facturas-gastos',
    color: 'text-cbvp-green',
    bg: 'bg-cbvp-green/8',
    border: 'border-cbvp-green/15 hover:border-cbvp-green/30',
  },
  {
    title: 'Campaña de Socios',
    description: 'Reportes de campaña de socios y depositos en Ueno Bank.',
    icon: HandCoins,
    path: '/campana-socios',
    color: 'text-cbvp-purple',
    bg: 'bg-cbvp-purple/8',
    border: 'border-cbvp-purple/15 hover:border-cbvp-purple/30',
  },
];

export default function DireccionAdministrativa() {
  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-cbvp-red/8 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-cbvp-red" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Direccion Administrativa</h1>
          <p className="text-xs text-white/40">Elegi un submodulo para continuar.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUBMODULOS.map((mod) => (
          <NavLink key={mod.path} to={mod.path} className={`glass rounded-xl p-4 border ${mod.border} card-hover cursor-pointer block`}>
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-xl ${mod.bg} flex items-center justify-center shrink-0`}>
                <mod.icon className={`w-5 h-5 ${mod.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1">{mod.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{mod.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 shrink-0 mt-1" />
            </div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
