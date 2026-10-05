// Частотный словарь: ~1000 самых частых знаменательных слов испанского (глаголы, существительные,
// прилагательные, наречия) в словарной форме. Служебные слова (de, que, el…) не входят — их знают все.
// Составлен по общедоступным частотным словарям и разговорным корпусам; порядок внутри списка приблизительный,
// поэтому используем три группы: топ-250, 251–500, 501–1000.

const TIER1 = `
ser estar tener hacer poder decir ir ver dar saber querer llegar pasar deber poner parecer quedar creer hablar llevar
dejar seguir encontrar llamar venir pensar salir volver tomar conocer vivir sentir tratar mirar contar empezar esperar buscar entrar
trabajar escribir perder entender pedir recibir recordar terminar conseguir necesitar leer cambiar abrir oír acabar ganar traer morir
explicar preguntar estudiar pagar ayudar gustar jugar escuchar usar comer cerrar faltar comprar vender viajar dormir beber
año día vez tiempo cosa hombre mujer vida parte casa mundo país forma caso momento persona gente niño trabajo lugar hora
semana mes noche mañana tarde agua padre madre hijo familia amigo ciudad calle problema mano ojo cabeza cara nombre palabra
pregunta respuesta verdad idea historia dinero precio coche puerta mesa comida café playa mar sol tienda médico escuela
clase libro teléfono móvil ejemplo número fin cuenta tipo grupo manera razón punto señor señora chico chica hermano
bueno grande nuevo mismo otro mucho poco todo primero último mejor peor pequeño largo alto bajo viejo joven importante
posible difícil fácil claro cierto solo propio siguiente feliz contento cansado listo bonito guapo caro barato caliente frío
bien mal muy más menos ahora siempre nunca también tampoco aquí allí hoy ayer luego después antes todavía casi tan bastante
demasiado pronto entonces así quizás mientras juntos sí no vale gracias perdón hola adiós claro
`;

const TIER2 = `
aprender enseñar mostrar ofrecer decidir intentar olvidar repetir mover continuar correr subir bajar sentar levantar despertar
lavar llover costar valer servir sacar descubrir preparar reservar alquilar mandar enviar contestar responder invitar celebrar
visitar pasear nadar bailar cantar tocar conducir aparcar cruzar parar cobrar ahorrar gastar elegir probar cortar romper arreglar
funcionar cuidar ducharse llamarse quejarse acordarse preocuparse casarse sentarse irse
amor guerra paz aire fuego tierra cielo luz color música canción película foto arte cultura idioma lengua español inglés pueblo
barrio piso apartamento habitación cocina baño salón dormitorio ventana pared suelo cama silla sofá llave calor fiesta cumpleaños
regalo boda viaje vacaciones avión tren autobús parada estación aeropuerto billete maleta hotel restaurante bar camarero menú
plato desayuno cena pan leche huevo carne pollo pescado arroz fruta verdura tomate patata queso aceite sal azúcar postre helado
zumo botella vaso taza cerveza vino cuerpo pie pierna brazo dedo boca diente oído corazón espalda estómago dolor enfermedad
salud farmacia medicina hospital cita clima lluvia viento nube invierno verano primavera otoño lunes martes miércoles jueves
viernes sábado domingo minuto segundo mediodía fin_de_semana
rápido lento fuerte débil limpio sucio lleno vacío abierto cerrado tranquilo nervioso enfermo triste aburrido divertido
interesante simpático amable antipático blanco negro rojo azul verde amarillo gris marrón rico pobre seguro libre ocupado
normal raro especial necesario verdadero falso real distinto igual diferente suficiente completo único principal
cerca lejos dentro fuera arriba abajo delante detrás enfrente encima debajo además incluso normalmente realmente seguramente
`;

const TIER3 = `
empresa oficina jefe sueldo contrato reunión cliente proyecto empleo paro papel documento ayuntamiento banco tarjeta efectivo
factura impuesto ley gobierno policía multa seguro gasolina carretera autopista tráfico semáforo esquina plaza parque jardín
árbol flor perro gato animal pájaro arena ola piscina montaña río lago isla campo naturaleza paisaje vista centro edificio
iglesia museo castillo puerto puente mercado supermercado panadería carnicería frutería peluquería gimnasio cine teatro concierto
partido equipo fútbol deporte juego pelota bicicleta moto barco taxi metro tranvía camino dirección mapa kilómetro metro_cuadrado
vecino compañero novio novia marido esposa abuelo abuela nieto tío tía primo sobrino bebé adulto pareja jefe_de
profesor alumno estudiante universidad instituto colegio curso examen nota deberes lección ejercicio error duda
ordenador internet correo mensaje llamada pantalla foto_de aplicación contraseña red página noticia periódico revista radio televisión
ropa camisa camiseta pantalón falda vestido zapato abrigo chaqueta gorra bolso bolsa cartera gafas reloj anillo talla
cosa_de objeto caja mueble armario estantería espejo lámpara cortina alfombra toalla jabón champú cepillo basura
medio mitad resto total cantidad parte_de nivel tamaño peso altura edad fecha cumple principio final mitad_de
situación problema_de solución pregunta_de opinión decisión elección posibilidad oportunidad suerte éxito fracaso miedo
alegría tristeza sorpresa interés cariño confianza paciencia prisa calma ruido silencio olor sabor
recuerdo sueño deseo plan objetivo esfuerzo cambio diferencia relación conversación discusión acuerdo consejo ayuda favor
servicio sistema programa tema idioma_de proceso resultado información dato orden ley_de derecho deber_de norma regla
mañana_de mediodía_de madrugada fin_de amanecer atardecer época siglo década pasado presente futuro
gritar llorar reír sonreír besar abrazar saludar despedir presentar conocerse llevarse pelear discutir convencer prometer
mentir confiar dudar imaginar soñar desear preferir odiar amar molestar importar interesar encantar doler apetecer
quedarse ponerse volverse hacerse llegar_a dar_igual echar echar_de_menos coger soltar tirar empujar
abrazo beso sonrisa lágrima grito risa voz canto baile
crecer nacer cumplir casarse_con divorciarse mudarse instalarse jubilarse
construir destruir producir crear formar cambiarse transformar mejorar empeorar aumentar bajar_de reducir crecer_de
comprobar revisar controlar vigilar proteger salvar rescatar atacar defender ganar_a perder_de vencer
enfadarse alegrarse asustarse cansarse aburrirse divertirse relajarse enamorarse
sencillo complicado práctico útil inútil peligroso tranquilo_de cómodo incómodo agradable desagradable precioso maravilloso
horrible terrible estupendo genial guay majo pesado gracioso serio tímido valiente cobarde listo_de tonto inteligente
sano gordo delgado rubio moreno pelirrojo calvo fuerte_de alto_de
mayor menor anterior posterior próximo actual moderno antiguo tradicional típico famoso conocido desconocido extranjero
nacional internacional local municipal privado público social político económico
temprano tarde_de despacio deprisa enseguida ya_no apenas solamente únicamente exactamente totalmente completamente
probablemente posiblemente afortunadamente desgraciadamente sinceramente francamente sobre_todo por_fin al_final
alrededor enfrente_de junto al_lado a_menudo a_veces de_repente de_nuevo otra_vez
pared_de techo tejado escalera ascensor portal terraza balcón garaje trastero piscina_de urbanización comunidad
alquiler hipoteca fianza contador luz_de agua_de gas calefacción aire_acondicionado enchufe bombilla grifo ducha
lavadora nevera horno microondas lavavajillas plancha aspiradora
médico_de enfermero dentista receta tarjeta_sanitaria urgencias ambulancia fiebre tos gripe resfriado alergia herida
cabeza_de garganta nariz oreja cuello hombro rodilla piel sangre hueso
desayunar comer_a cenar merendar picar tapear brindar pedir_la probar_el
tapa ración bocadillo tortilla paella ensalada sopa jamón chorizo marisco gamba calamar mejillón aceituna ajo cebolla
pimiento lechuga zanahoria limón naranja manzana plátano fresa uva melón sandía pera
caña copa refresco agua_con_gas hielo propina cuenta_de
euro céntimo cambio_de oferta descuento rebajas caja_de cola_de tique bolsa_de
lado frente fondo borde orilla superficie interior exterior norte sur oeste
existir permitir aparecer desaparecer ocupar realizar lograr alcanzar aceptar considerar reconocer dirigir suceder mantener
resultar comenzar convertir utilizar desarrollar establecer señalar añadir depender acercarse detener impedir evitar cubrir
devolver atender aprovechar apagar encender apuntar avisar cargar colgar compartir dibujar durar entregar equivocarse firmar
fumar guardar indicar llenar notar obtener ocurrir olvidarse pegar pesar pintar quitar recoger regresar respetar sufrir suponer
toser traducir unir vestirse votar
`;

function words(s) {
  return s.split(/\s+/).filter(Boolean).filter((w) => !w.includes('_'));
}

const seen = new Set();
export const FREQ = [...words(TIER1), ...words(TIER2), ...words(TIER3)].filter((w) => (seen.has(w) ? false : seen.add(w))).slice(0, 1000);

export const BANDS = [
  { from: 0, to: 250, title: 'Топ-250' },
  { from: 250, to: 500, title: '251–500' },
  { from: 500, to: 1000, title: '501–1000' },
];

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const bare = (es) => fold(String(es || '').replace(/^(el|la|los|las|un|una)\s+/i, ''));

// Ранг слова в частотном списке (0…999) или -1.
const RANK = new Map(FREQ.map((w, i) => [fold(w), i]));
export const freqRank = (es) => (RANK.has(bare(es)) ? RANK.get(bare(es)) : -1);

// Покрытие частотного словаря: сколько слов в словаре и сколько уже выучено, всего и по группам.
export function freqCoverage(words) {
  const inDict = new Set();
  const learned = new Set();
  for (const w of words || []) {
    const key = w.kind === 'verb' ? fold(w.verb) : (w.kind ? '' : bare(w.es));
    if (!key || !RANK.has(key)) continue;
    inDict.add(key);
    if ((w.reps || 0) >= 3) learned.add(key);
  }
  const bands = BANDS.map((b) => {
    const slice = FREQ.slice(b.from, b.to).map(fold);
    return { ...b, total: slice.length, inDict: slice.filter((k) => inDict.has(k)).length, learned: slice.filter((k) => learned.has(k)).length };
  });
  return { total: FREQ.length, inDict: inDict.size, learned: learned.size, bands };
}

// Следующие частые слова, которых ещё нет в словаре (кандидаты для «5 слов» и историй).
export function nextFrequent(words, n = 10) {
  const have = new Set((words || []).map((w) => (w.kind === 'verb' ? fold(w.verb) : bare(w.es))));
  return FREQ.filter((w) => !have.has(fold(w))).slice(0, n);
}
