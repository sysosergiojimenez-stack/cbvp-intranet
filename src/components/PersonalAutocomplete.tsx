import { useState, useEffect, useRef, useMemo } from 'react';
import { trpc } from '@/providers/trpc';
import { Search } from 'lucide-react';

interface PersonalAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (persona: { codigo: string; nombre: string }) => void;
  placeholder?: string;
  inputClassName?: string;
  minChars?: number;
  maxResults?: number;
}

export default function PersonalAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Buscar bombero...',
  inputClassName = '',
  minChars = 2,
  maxResults = 8,
}: PersonalAutocompleteProps) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const { data: personalResp } = trpc.personal.list.useQuery();

  const personalData = personalResp?.personal;

  const resultados = useMemo(() => {
    if (!personalData || value.trim().length < minChars) return [];
    const b = value.trim().toLowerCase();
    return personalData
      .filter(p =>
        p.nombreCompleto.toLowerCase().includes(b) ||
        p.codigo.toLowerCase().includes(b)
      )
      .slice(0, maxResults);
  }, [personalData, value, minChars, maxResults]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(event.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (codigo: string, nombre: string) => {
    onSelect({ codigo, nombre });
    setAbierto(false);
  };

  return (
    <div ref={contenedorRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
        <input
          type="text"
          value={value}
          onChange={e => {
            onChange(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => {
            if (value.trim().length >= minChars) setAbierto(true);
          }}
          placeholder={placeholder}
          className={`w-full bg-white/5 border border-white/10 rounded px-2 py-1 pl-8 text-xs text-white focus:border-cbvp-red/50 focus:outline-none ${inputClassName}`}
        />
      </div>
      {abierto && value.trim().length >= minChars && (
        <div className="absolute z-20 w-full mt-1 max-h-60 overflow-auto bg-[#1a1a24] border border-white/10 rounded-lg shadow-lg">
          {resultados.length === 0 ? (
            <div className="px-3 py-2 text-xs text-white/40">No se encontraron resultados</div>
          ) : (
            resultados.map(p => (
              <button
                key={p.codigo}
                type="button"
                onClick={() => handleSelect(p.codigo, p.nombreCompleto)}
                className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/5 transition-colors"
              >
                <span className="text-white/50">{p.codigo}</span>
                <span className="mx-1.5 text-white/20">-</span>
                {p.nombreCompleto}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
