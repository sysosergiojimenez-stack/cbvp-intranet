import { getFirestoreClient } from "./firestore";
import { crearNotificacion } from "./notificacionesFirestore";
import { enviarNotificacion } from "./pushNotifications";

function db() {
  return getFirestoreClient();
}
const colGrupos = () => db().collection("rolesGuardiaGrupos");
const colPersonal = () => db().collection("rolesGuardiaPersonal");
const colCalendario = () => db().collection("rolesGuardiaCalendario");

function idCalendario(idGrupo: string, anio: number, mes: number): string {
  return `${idGrupo}_${anio}_${mes}`;
}

// Fecha de manana en huso horario de Paraguay -- el contenedor de Cloud Run
// corre en UTC, y calcular "manana" con el reloj del sistema sin fijar el
// huso horario puede dar el dia equivocado segun la hora en que corra el job.
function manana(): { dia: number; mes: number; anio: number; etiqueta: string } {
  const referencia = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const partes = new Intl.DateTimeFormat("es-PY", {
    timeZone: "America/Asuncion",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(referencia);
  const dia = Number(partes.find((p) => p.type === "day")?.value || 0);
  const mes = Number(partes.find((p) => p.type === "month")?.value || 0);
  const anio = Number(partes.find((p) => p.type === "year")?.value || 0);
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
      const link = idRol ? `/roles-guardia/${idRol}` : "/roles-guardia";

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
