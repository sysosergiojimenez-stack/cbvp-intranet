import { useState } from 'react';
import { trpc } from '@/providers/trpc';
import { usePermiso } from '@/hooks/usePermiso';
import { UserPlus, Save, AlertTriangle, CheckCircle } from 'lucide-react';

export default function AgregarBombero() {
  const { puedeVerPersonal } = usePermiso();
  const [form, setForm] = useState({
    identificador: '', codigo: '', anioJuramento: '', categoria: 'COMBATIENTE',
    cargo: 'VOLUNTARIO(A)', rango: '', codigoRadial: '',
    primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '',
    correo: '', contrasena: '', nivelPermiso: '1', descripcionPermiso: 'BASICO',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const crearMutation = trpc.personal.crear.useMutation({
    onSuccess: () => {
      setSuccess('Bombero registrado correctamente');
      setError('');
      setForm({
        identificador: '', codigo: '', anioJuramento: '', categoria: 'COMBATIENTE',
        cargo: 'VOLUNTARIO(A)', rango: '', codigoRadial: '',
        primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '',
        correo: '', contrasena: '', nivelPermiso: '1', descripcionPermiso: 'BASICO',
      });
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err) => { setError(err.message); setSuccess(''); },
  });

  if (!puedeVerPersonal) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-6">Agregar Bombero</h1>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-cbvp-orange mx-auto mb-4" />
          <p className="text-white/60">No tienes permisos para acceder a este modulo.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.identificador || !form.codigo || !form.anioJuramento || !form.primerNombre || !form.primerApellido || !form.correo || !form.contrasena) {
      setError('Complete los campos obligatorios'); return;
    }
    crearMutation.mutate(form);
  };

  const field = (label: string, key: keyof typeof form, opts?: { type?: string; placeholder?: string; required?: boolean }) => (
    <div>
      <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">{label}{opts?.required ? ' *' : ''}</label>
      <input type={opts?.type || 'text'} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={opts?.placeholder || ''} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50" />
    </div>
  );

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="w-6 h-6 text-cbvp-red" />
        <h1 className="text-2xl font-bold text-white">Agregar Nuevo Bombero</h1>
      </div>
      {error && <div className="mb-4 p-3 bg-cbvp-red/10 border border-cbvp-red/20 rounded-lg text-sm text-cbvp-red-light">{error}</div>}
      {success && <div className="mb-4 p-3 bg-cbvp-green/10 border border-cbvp-green/20 rounded-lg text-sm text-cbvp-green flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {success}</div>}
      <form onSubmit={handleSubmit} className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider border-b border-white/5 pb-2">Datos Generales</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {field('Identificador', 'identificador', { placeholder: 'C-4852/14', required: true })}
          {field('Codigo', 'codigo', { placeholder: '4852', required: true })}
          {field('Anio Juramento', 'anioJuramento', { placeholder: '2014', required: true })}
          {field('Categoria', 'categoria')}
          {field('Cargo', 'cargo')}
          {field('Rango', 'rango')}
          {field('Codigo Radial', 'codigoRadial')}
        </div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider border-b border-white/5 pb-2 pt-2">Nombre Completo</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {field('Primer Nombre *', 'primerNombre', { required: true })}
          {field('Segundo Nombre', 'segundoNombre')}
          {field('Primer Apellido *', 'primerApellido', { required: true })}
          {field('Segundo Apellido', 'segundoApellido')}
        </div>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider border-b border-white/5 pb-2 pt-2">Acceso</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {field('Correo *', 'correo', { type: 'email', required: true })}
          {field('Contrasena *', 'contrasena', { type: 'password', required: true })}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Nivel Permiso *</label>
            <select value={form.nivelPermiso} onChange={e => setForm(f => ({ ...f, nivelPermiso: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cbvp-red/50">
              <option value="1">1 - Basico</option><option value="2">2 - Avanzado</option><option value="3">3 - Supervisor</option><option value="4">4 - Administrador</option><option value="5">5 - Total</option>
            </select>
          </div>
          {field('Descripcion Permiso', 'descripcionPermiso')}
        </div>
        <button type="submit" disabled={crearMutation.isPending} className="w-full mt-4 py-3 bg-cbvp-green hover:bg-cbvp-green/80 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
          <Save className="w-4 h-4" /> {crearMutation.isPending ? 'Guardando...' : 'Registrar Bombero'}
        </button>
      </form>
    </div>
  );
}
