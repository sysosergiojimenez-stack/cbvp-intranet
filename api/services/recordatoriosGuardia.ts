import { getFirestoreClient } from "./firestore";
import { crearNotificacion } from "./notificacionesFirestore";
import { enviarNotificacion } from "./pushNotifications";
import { fechaParaguay } from "../lib/fechas";

function db() {
  return getFirestoreClient();
}
const colGrupos = () => db().collection("rolesGuardiaGrupos");
const colPersonal = () => db().collection("rolesGuardiaPersonal");
const colCalendario = () => db().collection("rolesGuardiaCalendario");

function idCalendario(idGrupo: string, anio: number, mes: number): string {
  return `${idGrupo}_${anio}_${mes}`;
}

function manana(): { dia: number; mes: number; anio: number; etiqueta: string } {
  const { dia, mes, anio } = fechaParaguay(1);
  return { dia, mes, anio, etiqueta: `${dia}/${mes}/${anio}` };
}

/**
 * Recorre todos los grupos de Roles de Guardia y avisa (notificacion en la
 * app + push) al personal de los grupos que tienen guardia marcada para
 * manana en el calendario. Pensado para ser disparado 1 vez al dia por un
 * job de Cloud Scheduler contra /api/cron/recordatorios-guardia.
 */
export async function enviarRecordatoriosGuardia(): Promise<{ gruposAvisados: number; personasAvisadas: number }> {
  const { dia, mes, anio, etiqueta } = manana();

  const gruposSnap = await colGrupos().get();
  let gruposAvisados = 0;
  let personasAvisadas = 0;

  await Promise.all(
    gruposSnap.docs.map(async (grupoDoc) => {
      const grupo = grupoDoc.data();
      const idGrupo = grupoDoc.id;
      const nombreGrupo = String(grupo.nombreGrupo || "");
      const idRol = String(grupo.idRol || "");

      const calDoc = await colCalendario().doc(idCalendario(idGrupo, anio, mes)).get();
      if (!calDoc.exists) return;
      const dias: number[] = Array.isArray(calDoc.data()?.dias) ? calDoc.data()!.dias : [];
      if (!dias.includes(dia)) return;

      const personalSnap = await colPersonal().where("idGrupo", "==", idGrupo).get();
      const codigos = personalSnap.docs.map((d) => String(d.data().codigo || "").trim()).filter(Boolean);
      if (codigos.length === 0) return;

      gruposAvisados++;
      personasAvisadas += codigos.length;

      const titulo = "Recordatorio de guardia";
      const mensaje = `Tenes guardia manana ${etiqueta}${nombreGrupo ? ` (${nombreGrupo})` : ""}.`;
      const fechaISO = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const link = idRol ? `/mi-guardia/${idRol}/${idGrupo}?fecha=${fechaISO}` : "/roles-guardia";

      await Promise.all(
        codigos.map((codigo) =>
          crearNotificacion({ destinatarioCodigo: codigo, tipo: "rol_guardia", titulo, mensaje, link })
        )
      );
      await enviarNotificacion(codigos, { title: titulo, body: mensaje, url: link }).catch((err) =>
        console.error("Error enviando push de recordatorio de guardia:", err)
      );
    })
  );

  return { gruposAvisados, personasAvisadas };
}
