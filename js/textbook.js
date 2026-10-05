// Учебник: постоянная программа A1 → B2, урок за уроком — как по книге (Aula, Español en marcha).
// У каждого урока — жизненная цель (Бенидорм), грамматическая тема из единого перечня и опорные пункты
// правила. Пункты написаны и проверены заранее: ИИ разворачивает их в подробную теорию, но не придумывает
// правило сам — поэтому объяснения не «плывут» от раза к разу. В конце каждого блока — повторение (repaso).
// Только данные и чистые функции: экран — в teacher.js.

export const UNITS = [
  { n: 1, level: 'A1', title: 'Hola, soy…', ru: 'Знакомство', lessons: [
    { id: 'l1', title: 'Кто я: ser и личные местоимения', es: 'Me llamo… soy de…', topic: 'ser и estar',
      goal: 'Представиться соседу, хозяину квартиры, в бюро: имя, откуда, чем занимаешься.',
      vocab: 'страны, национальности, профессии',
      points: [
        'Местоимения: yo, tú, él/ella/usted, nosotros/-as, vosotros/-as, ellos/ellas/ustedes. Usted/ustedes — вежливое «вы», но спрягаются в 3-м лице.',
        'Местоимение-подлежащее обычно опускают: окончание глагола уже показывает лицо (Soy Nik, no «Yo soy Nik» без нужды). Его ставят для контраста или выделения.',
        'ser: soy, eres, es, somos, sois, son. С ser — имя, происхождение, национальность, профессия: Soy de Rusia. Es médico.',
        'Профессия после ser — без артикля: Soy jubilado, no «soy un jubilado». Артикль появляется, если есть прилагательное: Es un médico muy bueno.',
        'Vosotros — обычное «вы» к нескольким людям в Испании; ustedes — вежливое (в Латинской Америке ustedes для всех).',
      ] },
    { id: 'l2', title: 'Артикли и род существительных', es: 'el, la, un, una', topic: 'Артикли (el, la, un, una)',
      goal: 'Назвать вещи в квартире и в городе, понять вывески.',
      vocab: 'квартира и город',
      points: [
        'Определённые артикли: el, la, los, las; неопределённые: un, una, unos, unas. Un — «какой-то, один из», el — «тот самый, известный».',
        'Обычно -o — мужской род, -a — женский. Частые исключения: el día, el mapa, el problema, el idioma, el sofá; la mano, la foto, la moto, la radio.',
        'На -ción, -sión, -dad, -tad, -tud — женский род (la estación, la ciudad); на -aje, -or — чаще мужской (el viaje, el color; но la flor).',
        'Перед женским словом с ударным a-/ha- в единственном числе — el: el agua fría, el aula; во множественном — las aguas.',
        'Слияния: a + el = al (Voy al centro), de + el = del (la playa del Levante). С la слияния нет: a la playa.',
        'Русскому уху артикль кажется лишним, но в испанском существительное почти всегда с ним: Me gusta el café. Без артикля — при перечислении и неопределённом количестве: Bebo café.',
      ] },
    { id: 'l3', title: 'Множественное число и прилагательные', es: 'playas bonitas', topic: 'Согласование прилагательных',
      goal: 'Описать квартиру, пляж и город.',
      vocab: 'прилагательные-описания, цвета',
      points: [
        'Множественное: после гласной +s (casa → casas), после согласной +es (ciudad → ciudades), -z → -ces (luz → luces). Ударение может пропасть или появиться: autobús → autobuses, joven → jóvenes.',
        'Прилагательное обычно стоит после существительного и согласуется в роде и числе: un piso pequeño, unas playas bonitas.',
        'Прилагательные на -e и на согласную не меняются по роду: grande, verde, azul, fácil (una casa grande, un perro grande).',
        'Национальности на согласную всё же получают -a: español → española, inglés → inglesa.',
        'Bueno, malo, grande перед существительным: buen día, mal tiempo, gran ciudad (gran = великий, а не просто большой).',
      ] },
    { id: 'l4', title: 'hay и está: что есть и где находится', es: '¿Dónde está…? Hay…', topic: 'hay и está / están',
      goal: 'Спросить дорогу и что есть рядом: аптека, Mercadona, остановка.',
      vocab: 'места в городе, ориентиры (cerca, al lado de, enfrente de)',
      points: [
        'Hay — «есть, имеется» о том, что упоминаем впервые: Hay una farmacia cerca. Hay — одна форма для ед. и мн. числа: Hay dos supermercados.',
        'Está/están — «находится» о конкретном, уже известном предмете: La farmacia está al lado del banco.',
        'После hay — un/una, числа, mucho, без артикля; никогда hay el/la: «Hay el banco» — ошибка.',
        'Вопросы: ¿Hay un cajero por aquí? (есть ли вообще) — ¿Dónde está el cajero? (где тот, что я ищу).',
        'Место: cerca de, lejos de, al lado de, enfrente de, detrás de, a la derecha / a la izquierda, todo recto.',
      ] },
  ] },
  { n: 2, level: 'A1', title: 'Mi día', ru: 'Мой день', lessons: [
    { id: 'l5', title: 'Presente: правильные глаголы', es: 'hablo, como, vivo', topic: 'Presente: правильные глаголы',
      goal: 'Рассказать о себе: где живёшь, что делаешь каждый день.',
      vocab: 'частые действия',
      points: [
        'Три спряжения по окончанию инфинитива: -ar (hablar), -er (comer), -ir (vivir).',
        '-ar: -o, -as, -a, -amos, -áis, -an. -er: -o, -es, -e, -emos, -éis, -en. -ir: -o, -es, -e, -imos, -ís, -en.',
        'Presente — это и привычка (Trabajo por la mañana), и сейчас, и ближайшее будущее с указанием времени (Mañana trabajo).',
        'Ударение решает смысл: hablo (я говорю) — habló (он сказал). Окончания vosotros пишутся с ударением: habláis, coméis, vivís.',
      ] },
    { id: 'l6', title: 'Presente: неправильные глаголы', es: 'quiero, puedo, tengo', topic: 'Presente: неправильные глаголы',
      goal: 'Сказать, что хочешь, можешь и должен сделать.',
      vocab: 'самые частые глаголы',
      points: [
        'Глаголы с чередованием в корне: e → ie (querer: quiero, empezar, cerrar, preferir), o → ue (poder: puedo, volver, dormir, costar), e → i (pedir: pido, repetir, servir).',
        'Чередование есть во всех формах, кроме nosotros и vosotros («ботинок»): queremos, queréis.',
        'Неправильная только форма yo: hago, pongo, salgo, traigo, conozco, sé, doy, veo. С tener и venir — и yo, и чередование: tengo/tienes, vengo/vienes.',
        'Полностью неправильные: ser (soy, eres…), estar (estoy, estás…), ir (voy, vas, va, vamos, vais, van).',
        'Tener que + инфинитив — «должен» (Tengo que ir al médico); hay que + инфинитив — «нужно» безлично.',
      ] },
    { id: 'l7', title: 'Возвратные глаголы: распорядок дня', es: 'me levanto, me ducho', topic: 'Возвратные глаголы',
      goal: 'Описать свой обычный день по часам.',
      vocab: 'распорядок дня',
      points: [
        'Возвратное местоимение меняется по лицу: me, te, se, nos, os, se. Me levanto, te duchas, se acuesta.',
        'Местоимение стоит перед спряжённым глаголом, но присоединяется к инфинитиву и герундию: Voy a levantarme = Me voy a levantar.',
        'Возвратность меняет смысл: lavar el coche — lavarse las manos; llamar a alguien — llamarse (меня зовут = me llamo); ir — irse (уходить).',
        'С частями тела и одеждой — артикль, а не притяжательное: Me lavo el pelo, no «mi pelo».',
        'Русское «-ся» и испанское se совпадают не всегда: despertarse (просыпаться) — да, но «учиться» = estudiar/aprender без se.',
      ] },
    { id: 'l8', title: 'Числа, время и даты', es: '¿Qué hora es?', topic: 'Числа, время и даты',
      goal: 'Договориться о встрече, понять цену и часы работы.',
      vocab: 'дни недели, месяцы, цены',
      points: [
        '16–29 пишутся одним словом: dieciséis, veintiuno, veintidós; с 31 — через y: treinta y uno. Cien — ровно 100, ciento — дальше (ciento veinte); quinientos, setecientos, novecientos — неправильные.',
        '¿Qué hora es? — Es la una; Son las dos/las tres. Y cuarto, y media, menos cuarto. A las ocho = в восемь.',
        'Время суток: de la mañana, de la tarde, de la noche; на табличках часто 24-часовой формат (17:00).',
        'Дни недели с артиклем: el lunes (в этот понедельник), los lunes (по понедельникам); без предлога en.',
        'Дата: el 5 de octubre; месяцы с маленькой буквы. Цены: ¿Cuánto cuesta? / ¿Cuánto es? — Son 3,50 € (tres euros con cincuenta).',
      ] },
  ] },
  { n: 3, level: 'A1', title: 'De compras y de tapas', ru: 'Магазин и бар', lessons: [
    { id: 'l9', title: 'ser или estar', es: 'es / está', topic: 'ser и estar',
      goal: 'Описать людей и вещи и сказать, как дела и где что.',
      vocab: 'характер, состояние, вкус еды',
      points: [
        'Ser — что/кто это по сути: профессия, происхождение, характер, материал, время и дата (Son las tres), место события (La fiesta es en mi casa).',
        'Estar — где находится (El hotel está en la playa) и состояние/результат (Estoy cansado, La tienda está cerrada).',
        'Прилагательные меняют смысл: ser listo (умный) — estar listo (готов); ser aburrido (скучный) — estar aburrido (скучать); ser malo (плохой) — estar malo (болеть); ser rico (богатый) — estar rico (вкусный).',
        'Bien/mal — только с estar: Está bien, Estoy mal. Muerto, vivo — с estar.',
        'Простой тест: «что это такое?» → ser; «где и в каком сейчас состоянии?» → estar.',
      ] },
    { id: 'l10', title: 'Указательные: este, ese, aquel', es: 'este de aquí', topic: 'Указательные (este, ese, aquel)',
      goal: 'Показать, что именно хочешь купить, на рынке и в магазине.',
      vocab: 'продукты, одежда',
      points: [
        'Три степени расстояния: este (здесь, у меня), ese (там, у тебя / недалеко), aquel (вон там, далеко). Совпадают с aquí, ahí, allí.',
        'Формы согласуются: este, esta, estos, estas; ese, esa, esos, esas; aquel, aquella, aquellos, aquellas.',
        'Нейтральные esto, eso, aquello — про неизвестный предмет или ситуацию: ¿Qué es esto? Eso es verdad. Они никогда не стоят перед существительным.',
        'В магазине: ¿Me da este de aquí? — Ese no, el otro. Указательное может заменять существительное (раньше на нём ставили ударение — éste, сейчас не обязательно).',
      ] },
    { id: 'l11', title: 'gustar и похожие глаголы', es: 'me gusta, me duele', topic: 'gustar и похожие глаголы',
      goal: 'Сказать, что любишь и что не любишь, что болит, что хочется.',
      vocab: 'еда, хобби, тело',
      points: [
        'Gustar строится «наоборот»: подлежащее — то, что нравится. Me gusta el café (кофе нравится мне). Me gustan las tapas (мн. ч. → gustan). Me gusta nadar (инфинитив → ед. ч.).',
        'Местоимения: me, te, le, nos, os, les. A mí, a ti, a él… добавляют для контраста или ясности: A mí me gusta, a ella no. A mi mujer le gusta el mar.',
        'Так же работают encantar (обожать), interesar, doler (Me duele la cabeza / Me duelen los pies), molestar, apetecer (хотеться: ¿Te apetece un café? — очень испанское).',
        'Согласие: A mí también (мне тоже нравится) / A mí tampoco (мне тоже не нравится). Несогласие: A mí sí / A mí no.',
        'Ошибка русскоговорящих: «Yo gusto el café» — неверно; «Me gusta los…» — неверно, нужно gustan.',
      ] },
    { id: 'l12', title: 'Вопросительные слова и вежливые просьбы', es: '¿Qué? ¿Cuál? ¿Me pone…?', topic: 'Вопросительные слова',
      goal: 'Спросить что угодно в баре, магазине, на ресепшене.',
      vocab: 'бар и тапас',
      points: [
        'Qué, quién, dónde, adónde (куда), cuándo, cómo, por qué, cuánto/a/os/as, cuál/cuáles — все с ударением; вопрос открывается знаком ¿.',
        'Qué или cuál: qué + существительное (¿Qué vino tienes?) и «что?» вообще; cuál — выбор из известного (¿Cuál prefieres?) и с ser про данные: ¿Cuál es tu teléfono? (не «¿Qué es…?»).',
        'Cuánto согласуется: ¿Cuántas personas? ¿Cuánto cuesta?',
        'Por qué (почему, раздельно с ударением) — porque (потому что, слитно) — el porqué (причина).',
        'Вежливо в Испании: ¿Me pone una caña? ¿Me puede ayudar? ¿Me cobra? — вопрос в presente звучит естественно, «quiero» в баре тоже нормально, если с por favor.',
      ] },
    { id: 'l13', title: 'Притяжательные: mi, tu, su, nuestro', es: 'mi piso, su coche', topic: 'Притяжательные (mi, tu, su)',
      goal: 'Рассказать о семье и своих вещах.',
      vocab: 'семья, вещи',
      points: [
        'Перед существительным: mi, tu, su (ед.), mis, tus, sus (мн.). Они согласуются с предметом, а не с владельцем: mis hijos.',
        'Nuestro/vuestro меняются ещё и по роду: nuestra casa, vuestros amigos.',
        'Su многозначно: его, её, их, ваш (usted). Для ясности: el coche de él, de usted.',
        'Полные формы после существительного или без него: mío, tuyo, suyo, nuestro: Es mío. Un amigo mío (один мой друг).',
        'С частями тела и одеждой — артикль: Me duele la espalda, no «mi espalda».',
      ] },
  ] },
  { n: 4, level: 'A2', title: 'Planes', ru: 'Планы и сейчас', lessons: [
    { id: 'l14', title: 'ir a + инфинитив: планы', es: 'voy a ir', topic: 'ir a + инфинитив',
      goal: 'Рассказать о планах на выходные и на лето.',
      vocab: 'досуг, поездки по побережью',
      points: [
        'Ir (voy, vas, va, vamos, vais, van) + a + инфинитив = ближайшее будущее, план: Voy a llamar al casero.',
        'Указатели: esta tarde, mañana, el fin de semana que viene, el próximo verano, dentro de dos días.',
        'Vamos a + инфинитив ещё и «давай(те)»: ¡Vamos a ver! ¡Vamos a comer!',
        'Похожие конструкции: pensar + инфинитив (собираюсь, думаю), querer + инфинитив, tener ganas de + инфинитив.',
        'В разговоре ir a + инфинитив встречается чаще, чем будущее время (futuro).',
      ] },
    { id: 'l15', title: 'estar + герундий: прямо сейчас', es: 'estoy comiendo', topic: 'estar + герундий',
      goal: 'Сказать по телефону, что ты сейчас делаешь.',
      vocab: 'действия дома и на улице',
      points: [
        'Герундий: -ar → -ando (hablando), -er/-ir → -iendo (comiendo, viviendo).',
        'Особые формы: leyendo, oyendo, yendo (ir), durmiendo, muriendo, pidiendo, diciendo, sintiendo, viniendo.',
        'Estar + герундий — действие в процессе прямо сейчас или временно: Estoy viviendo en Benidorm este año.',
        'В испанском чаще, чем в английском, используют простое presente: ¿Qué haces? — Leo. Estar + герундий подчёркивает «в этот момент».',
        'Местоимения: me estoy duchando = estoy duchándome (тогда появляется ударение).',
      ] },
    { id: 'l16', title: 'muy и mucho, bueno и bien', es: 'muy bien, mucha gente', topic: 'muy и mucho',
      goal: 'Оценить еду, погоду, услуги, не путая слова.',
      vocab: 'оценки и количество',
      points: [
        'Muy — перед прилагательным и наречием: muy caro, muy bien. Не меняется.',
        'Mucho перед существительным согласуется: mucho calor, mucha gente, muchos turistas, muchas playas.',
        'Mucho после глагола — «много, сильно», не меняется: Trabajo mucho. Me gusta mucho (не «muy»).',
        'Muy нельзя оставить одно: ¿Está bueno? — Sí, mucho (a не «muy»). Muy mucho — неправильно.',
        'Bueno/malo — прилагательные (Es un buen restaurante), bien/mal — наречия (Cocina bien). Hace buen tiempo, но Estoy bien.',
      ] },
    { id: 'l17', title: 'Сравнения', es: 'más barato que', topic: 'Сравнения (más… que, tan… como)',
      goal: 'Сравнить цены, районы, рестораны, Бенидорм и Аликанте.',
      vocab: 'цены, районы, качество',
      points: [
        'Más/menos + прилагательное + que: Alicante es más grande que Benidorm.',
        'Равенство: tan + прилагательное + como (tan caro como); tanto/tanta/tantos/tantas + существительное + como (tantos turistas como); глагол + tanto como.',
        'Неправильные: mejor, peor, mayor (старше, больше), menor; «más bueno» в значении «лучше» — ошибка.',
        'Превосходная степень: el/la más… de: la playa más bonita de la zona. С числами — más de: más de diez euros.',
        'Очень-очень: -ísimo (carísimo, buenísimo) — разговорно и часто.',
      ] },
  ] },
  { n: 5, level: 'A2', title: '¿Qué hiciste?', ru: 'Что было', lessons: [
    { id: 'l18', title: 'Pretérito perfecto: сегодня и в жизни', es: 'he comido', topic: 'Pretérito perfecto',
      goal: 'Рассказать, что ты сделал сегодня и бывал ли где-то.',
      vocab: 'дела, опыт, путешествия',
      points: [
        'Haber в presente (he, has, ha, hemos, habéis, han) + причастие: -ar → -ado, -er/-ir → -ido.',
        'Неправильные причастия: hecho, dicho, visto, escrito, puesto, vuelto, abierto, roto, muerto, descubierto.',
        'В Испании perfecto — для прошлого, связанного с «сейчас»: сегодня, на этой неделе, в этом году (Hoy he ido a la playa), опыт в жизни (¿Has estado en Valencia?), ya / todavía no / nunca.',
        'Haber и причастие не разделяются, местоимения стоят перед haber: Lo he visto, no «He lo visto».',
        'Причастие после haber не меняется по роду и числу: Las he comprado.',
      ] },
    { id: 'l19', title: 'Pretérito indefinido: правильные глаголы', es: 'ayer hablé', topic: 'Pretérito indefinido',
      goal: 'Рассказать, что было вчера и в прошлом отпуске.',
      vocab: 'события и путешествия',
      points: [
        '-ar: -é, -aste, -ó, -amos, -asteis, -aron. -er/-ir: -í, -iste, -ió, -imos, -isteis, -ieron.',
        'Законченное действие в завершённом периоде: ayer, anoche, el lunes pasado, en 2019, hace dos años.',
        'Ударение важно: hablo (говорю) — habló (он говорил). Nosotros у -ar и -ir совпадает с presente: hablamos, vivimos — понятно из контекста.',
        'Орфография в yo: busqué (c → qu), llegué (g → gu), empecé (z → c). Leer → leyó, leyeron.',
        'Граница с perfecto: «сегодня» → he comido; «вчера» → comí.',
      ] },
    { id: 'l20', title: 'Indefinido: неправильные глаголы', es: 'fui, tuve, hice', topic: 'Pretérito indefinido',
      goal: 'Рассказать историю из поездки или про поход к врачу.',
      vocab: 'частые события',
      points: [
        'Ser и ir совпадают: fui, fuiste, fue, fuimos, fuisteis, fueron — смысл ясен из контекста (Fui a Altea / Fue un día bonito).',
        'Группа с новой основой и окончаниями без ударений -e, -iste, -o, -imos, -isteis, -ieron: estuve, tuve, pude, puse, supe, hice (hizo), vine, quise.',
        'С основой на j — -eron, а не -ieron: dije → dijeron, traje → trajeron, conduje → condujeron.',
        'Dar: di, diste, dio; ver: vi, viste, vio — без ударений.',
        'Глаголы на -ir с чередованием меняются в 3-м лице: pedir → pidió, pidieron; dormir → durmió, durmieron; sentir → sintió.',
      ] },
    { id: 'l21', title: 'Pretérito imperfecto: как было раньше', es: 'antes vivía', topic: 'Pretérito imperfecto',
      goal: 'Рассказать, как ты жил раньше и как было в детстве.',
      vocab: 'прошлое, привычки, описание',
      points: [
        '-ar → -aba (hablaba, hablábamos), -er/-ir → -ía (comía, vivía). Неправильных всего три: ser (era), ir (iba), ver (veía).',
        'Привычки и повторяющееся в прошлом: Antes vivía en Moscú; De pequeño jugaba al fútbol.',
        'Описание фона: погода, обстановка, возраст, время: Hacía calor, Eran las tres, Tenía veinte años.',
        'Указатели: antes, de pequeño, siempre, normalmente, todos los días, cuando era joven.',
        'Русский ориентир: часто это несовершенный вид («жил, бывало ходил»), но не всегда — подробнее в уроке «indefinido или imperfecto».',
      ] },
  ] },
  { n: 6, level: 'A2', title: 'En la ciudad', ru: 'Дела в городе', lessons: [
    { id: 'l22', title: 'Местоимения-дополнения: lo, la, le, se lo', es: 'lo compro, se lo doy', topic: 'Местоимения-дополнения (lo, la, le)',
      goal: 'Не повторять одно и то же слово: «купил его, отдал ей».',
      vocab: 'покупки, документы, передать и вернуть',
      points: [
        'Прямое дополнение (кого? что?): lo, la, los, las — ¿El pan? Lo compro yo. Косвенное (кому?): le, les. Для me, te, nos, os формы общие.',
        'Порядок: сначала косвенное, потом прямое: Me lo das. Te la traigo.',
        'Le/les перед lo/la/los/las превращается в se: Se lo doy (a él / a ella / a usted), no «le lo».',
        'Позиция: перед спряжённым глаголом (Lo quiero) или присоединяется к инфинитиву, герундию и утвердительному императиву: Quiero verlo, Dámelo.',
        'Удвоение: при a + человек косвенное местоимение обычно повторяется: A mi madre le compro flores.',
        'В Испании для мужчины-человека часто говорят le вместо lo: Le vi ayer (leísmo — норма это допускает).',
      ] },
    { id: 'l23', title: 'Предлоги: a, en, de, con, desde, hasta', es: 'voy a, estoy en', topic: 'Предлоги (a, en, de, con…)',
      goal: 'Говорить о транспорте, направлениях и времени без ошибок.',
      vocab: 'транспорт, направления',
      points: [
        'A — направление и время: Voy a Alicante, a las nueve. En — место нахождения: Estoy en Alicante. «Voy en Alicante» — ошибка.',
        'Транспорт: en coche, en autobús, en tren; но a pie, a caballo.',
        'Личное a — перед прямым дополнением-человеком: Veo a Juan, Busco a mi hijo (но Busco un piso).',
        'De — принадлежность, происхождение, материал: la casa de Ana, Soy de Kiev, una mesa de madera. Desde … hasta / de … a — откуда докуда: de 9 a 14.',
        'Con mí/ti — нельзя: conmigo, contigo. Sin + без артикля часто: café sin azúcar.',
        'Por и para — отдельный урок B1.',
      ] },
    { id: 'l24', title: 'Повелительное наклонение: tú и usted', es: 'pasa, siéntese', topic: 'Повелительное наклонение (tú, usted)',
      goal: 'Понять инструкции врача, таксиста, хозяина и самому попросить.',
      vocab: 'инструкции и просьбы',
      points: [
        'Tú (утвердительный) = форма 3-го лица presente: habla, come, escribe, cierra.',
        'Неправильные для tú: ten, ven, pon, sal, haz, di, ve (ir), sé (ser).',
        'Usted/ustedes берут формы субхунтива: hable, coma, venga, haga, siéntese; vosotros: -ad, -ed, -id (venid, comed).',
        'Местоимения присоединяются к утвердительному императиву: Dímelo, Siéntese, Ponlo aquí — с ударением, если сдвинулось.',
        'В Испании просьба императивом нормальна и не грубая, особенно с por favor: Ponme una caña. Мягче — вопросом: ¿Me pones…?',
      ] },
  ] },
  { n: 7, level: 'B1', title: 'Contar historias', ru: 'Рассказать историю', lessons: [
    { id: 'l25', title: 'Indefinido или imperfecto', es: 'cuando llegué, llovía', topic: 'Indefinido или imperfecto',
      goal: 'Рассказать связную историю: что случилось и при каких обстоятельствах.',
      vocab: 'происшествия, путешествия',
      points: [
        'Indefinido — события, которые двигают сюжет вперёд («и тогда…»): Llegué, abrí la puerta y vi…',
        'Imperfecto — фон, декорации, то, что «шло» в тот момент: Llovía, había mucha gente, estaba cansado.',
        'Схема прерывания: фон в imperfecto, событие в indefinido: Estaba en la ducha cuando sonó el teléfono.',
        'Глаголы, меняющие смысл: conocí (познакомился) — conocía (был знаком); supe (узнал) — sabía (знал); quise (попытался) / no quise (отказался) — quería (хотел); tuve que (пришлось и сделал) — tenía que (надо было).',
        'Ограниченный период — indefinido, даже если долго: Viví diez años en Moscú (и это закончилось).',
      ] },
    { id: 'l26', title: 'Pluscuamperfecto: ещё раньше', es: 'ya había salido', topic: 'Pluscuamperfecto',
      goal: 'Объяснить, что произошло до другого события в прошлом.',
      vocab: 'опоздания, недоразумения',
      points: [
        'Había, habías, había, habíamos, habíais, habían + причастие: había comido.',
        'Действие раньше другого прошлого: Cuando llegué, el autobús ya había salido.',
        'Часто с ya, todavía no, nunca antes: Nunca había probado la paella valenciana.',
        'Нужно, когда порядок событий иначе непонятен; в простых цепочках «сначала — потом» хватает indefinido.',
      ] },
    { id: 'l27', title: 'Futuro simple', es: 'mañana lloverá', topic: 'Futuro simple',
      goal: 'Говорить о прогнозах, обещаниях и предположениях.',
      vocab: 'погода, планы, обещания',
      points: [
        'Окончания добавляются к инфинитиву: -é, -ás, -á, -emos, -éis, -án (hablaré, comerás).',
        'Неправильные основы: tendr-, pondr-, saldr-, vendr-, podr-, sabr-, habr-, querr-, dir-, har-, cabr-.',
        'Употребление: прогноз (Mañana lloverá), обещание (Te llamaré), торжественные планы.',
        'Предположение о настоящем: ¿Dónde estará Juan? — Estará en el bar (наверное, он в баре).',
        'Для обычных планов в разговоре чаще ir a + инфинитив или presente.',
      ] },
    { id: 'l28', title: 'Condicional: вежливость и советы', es: '¿Podría…? Yo que tú…', topic: 'Condicional',
      goal: 'Вежливо просить, давать совет, говорить о желаемом.',
      vocab: 'вежливые просьбы, советы',
      points: [
        'Инфинитив + -ía, -ías, -ía, -íamos, -íais, -ían; те же неправильные основы, что у futuro: tendría, podría, haría, diría.',
        'Вежливость: ¿Podría ayudarme? Me gustaría reservar una mesa. Querría — тоже вежливо.',
        'Совет: Yo que tú, iría al médico. Deberías descansar.',
        'Предположение о прошлом: Serían las diez cuando llegó (было, наверное, около десяти).',
        'Нереальные условия с si — в B2 (si tuviera…, iría…).',
      ] },
  ] },
  { n: 8, level: 'B1', title: 'Deseos y consejos', ru: 'Желания и советы', lessons: [
    { id: 'l29', title: 'Presente de subjuntivo', es: 'quiero que vengas', topic: 'Presente de subjuntivo',
      goal: 'Высказать желание, просьбу, сомнение, эмоцию о другом человеке.',
      vocab: 'пожелания, чувства, мнения',
      points: [
        'Образование от формы yo presente: hablo → hable, tengo → tenga, conozco → conozca; -ar получает e, -er/-ir — a.',
        'Неправильные: ser → sea, estar → esté, ir → vaya, haber → haya, saber → sepa, dar → dé.',
        'Когда: желание и влияние на другого (Quiero que vengas), эмоции (Me alegro de que estés aquí), оценка (Es importante que descanses), сомнение и отрицание мнения (No creo que llueva).',
        'Один и тот же человек — инфинитив: Quiero ir. Разные люди — que + subjuntivo: Quiero que vayas.',
        'Утверждение мнения — индикатив: Creo que llueve. Отрицание — субхунтив: No creo que llueva.',
        'Готовые фразы: ¡Que te mejores! ¡Que aproveche! ¡Que tengas buen día! Ojalá + subj.',
      ] },
    { id: 'l30', title: 'Отрицательный императив', es: 'no toques', topic: 'Отрицательный императив',
      goal: 'Понимать запреты и самому сказать «не делай».',
      vocab: 'запреты и предупреждения',
      points: [
        'Отрицательный императив для всех лиц — no + presente de subjuntivo: no hables, no habléis, no hable usted.',
        'Неправильные — как в субхунтиве: no vayas, no seas, no hagas, no digas, no pongas.',
        'Местоимения стоят перед глаголом: Dímelo → No me lo digas; Siéntate → No te sientes.',
        'На табличках часто инфинитив: No fumar, No tocar.',
      ] },
    { id: 'l31', title: 'por и para', es: 'para ti, por la playa', topic: 'por и para',
      goal: 'Говорить о цели, причине, цене и маршруте без путаницы.',
      vocab: 'маршруты, покупки, причины',
      points: [
        'Para — цель, назначение, вперёд: para + инфинитив (Estudio para hablar con los vecinos), получатель (para ti), срок (para el lunes), направление (el tren para Alicante), мнение (para mí).',
        'Por — причина (Lo hago por ti, Gracias por todo), путь «через/по» (Paseo por la playa), обмен и цена (por 10 euros), часть дня (por la mañana), средство (por teléfono), приблизительное место (por aquí).',
        'Ориентир: para — куда стремится действие; por — что за ним стоит или через что проходит.',
        'Устойчивые выражения: por favor, por fin, por eso, por supuesto, por ejemplo, para siempre.',
      ] },
    { id: 'l32', title: 'Относительные: que, donde, lo que', es: 'el piso que alquilo', topic: 'Относительные (que, donde, lo que)',
      goal: 'Строить длинные фразы: «квартира, которую я снимаю», «то, что мне нужно».',
      vocab: 'жильё, услуги',
      points: [
        'Que — основное слово для людей и предметов: El piso que alquilo está cerca del mar.',
        'Donde — место: El pueblo donde vivo.',
        'Lo que — «то, что» (нейтральное): Lo que necesito es un fontanero.',
        'После предлога — el/la/los/las que или quien(es) для людей: La chica con la que hablé; El hombre a quien llamé.',
        'Без запятой — уточняет, с запятыми — добавляет сведения: Mis vecinos, que son ingleses, son muy simpáticos.',
      ] },
    { id: 'l33', title: 'Косвенная речь', es: 'dijo que vendría', topic: 'Косвенная речь',
      goal: 'Передать, что сказал врач, хозяин, сотрудник ayuntamiento.',
      vocab: 'звонки, сообщения, поручения',
      points: [
        'Dice que … — время не меняется: Dice que está enfermo.',
        'Dijo que … — время сдвигается назад: está → estaba, ha llegado / llegó → había llegado, llegará → llegaría, va a → iba a.',
        'Просьба в косвенной речи — que + subjuntivo: Me pide que llame mañana (в прошлом — me pidió que llamara).',
        'Меняются местоимения, «здесь» и «время»: aquí → allí, hoy → ese día, mañana → al día siguiente.',
        'Вопросы: Me preguntó si quería café / dónde vivía.',
      ] },
  ] },
  { n: 9, level: 'B2', title: 'Matices', ru: 'Тонкости', lessons: [
    { id: 'l34', title: 'Imperfecto de subjuntivo', es: 'quería que vinieras', topic: 'Imperfecto de subjuntivo',
      goal: 'Говорить о желаниях и просьбах в прошлом и о нереальном.',
      vocab: 'воспоминания, сожаления',
      points: [
        'Образование от 3-го лица мн. ч. indefinido: tuvieron → tuviera; hablaron → hablara; fueron → fuera.',
        'Окончания: -ra, -ras, -ra, -ramos (с ударением: habláramos), -rais, -ran; вариант на -se (hablase) тоже правильный.',
        'Главное в прошлом → imperfecto de subjuntivo: Quería que vinieras. Me pidió que esperara.',
        'Ojalá + imperfecto de subjuntivo — маловероятное желание: Ojalá tuviera más tiempo.',
        'Вежливое: Quisiera un café.',
      ] },
    { id: 'l35', title: 'Условные предложения с si', es: 'si tuviera…, iría…', topic: 'Условные предложения (si…)',
      goal: 'Говорить о реальных и воображаемых условиях.',
      vocab: 'планы, мечты',
      points: [
        'Реальное: si + presente → presente/futuro/императив: Si llueve, no vamos. Si puedes, llámame.',
        'Маловероятное/воображаемое: si + imperfecto de subjuntivo → condicional: Si tuviera dinero, compraría un piso en Altea.',
        'Нереальное в прошлом: si + pluscuamperfecto de subjuntivo → condicional compuesto: Si hubiera sabido, habría venido.',
        'После si никогда не ставится futuro и condicional: «Si tendré…» — ошибка.',
      ] },
    { id: 'l36', title: 'Субхунтив после союзов', es: 'cuando llegues', topic: 'Субхунтив после союзов (cuando, aunque, para que)',
      goal: 'Договариваться о будущих действиях: «когда приедешь — позвони».',
      vocab: 'договорённости',
      points: [
        'Cuando + будущее событие → subjuntivo: Cuando llegues, llámame. О привычке или прошлом — индикатив: Cuando llego, ceno.',
        'Para que + всегда subjuntivo: Te lo digo para que lo sepas.',
        'Aunque + индикатив — факт (хотя идёт дождь — и он идёт); aunque + subjuntivo — допущение или неважно (даже если пойдёт).',
        'Antes de que — всегда subjuntivo; después de que, hasta que, en cuanto — по той же логике, что и cuando.',
      ] },
    { id: 'l37', title: 'Пассив и безличное se', es: 'se alquila, se habla', topic: 'Пассив и безличное se',
      goal: 'Понимать объявления и инструкции: se alquila, se prohíbe.',
      vocab: 'объявления, правила',
      points: [
        'Пассивное se: глагол согласуется с предметом: Se alquila piso / Se alquilan pisos. Se vende coche.',
        'Безличное se — «люди вообще»: Aquí se vive bien. Se habla español.',
        'Ser + причастие (El museo fue construido…) — в основном письменная речь; в разговоре чаще se или 3-е лицо мн. ч.: Me robaron el móvil.',
        'Случайность: se me olvidó, se me cayó — «так получилось», без вины.',
      ] },
    { id: 'l38', title: 'Глагольные перифразы', es: 'acabo de llegar', topic: 'Глагольные перифразы (acabar de, volver a, llevar + gerundio)',
      goal: 'Говорить естественно: «только что», «снова», «уже два года как».',
      vocab: 'время и продолжительность',
      points: [
        'Acabar de + инфинитив — только что: Acabo de llegar.',
        'Volver a + инфинитив — снова: Vuelvo a llamarte mañana.',
        'Llevar + время + герундий — сколько уже длится: Llevo dos años viviendo en Benidorm.',
        'Dejar de + инфинитив — перестать: He dejado de fumar. Empezar a, ponerse a — начать.',
        'Seguir + герундий — продолжать: Sigue lloviendo.',
      ] },
  ] },
];

// Всё по порядку: уроки и после каждого блока — повторение.
export const STEPS = UNITS.flatMap((u) => [
  ...u.lessons.map((l) => ({ ...l, kind: 'lesson', unit: u.n, level: u.level })),
  {
    id: `r${u.n}`, kind: 'repaso', unit: u.n, level: u.level,
    title: `Повторение: ${u.ru}`, es: `Repaso ${u.n}`,
    topic: u.lessons[0].topic,
    topics: [...new Set(u.lessons.map((l) => l.topic))],
    lessonIds: u.lessons.map((l) => l.id),
    goal: `Проверить себя по всем урокам блока «${u.ru}».`,
    points: u.lessons.map((l) => `${l.title}: ${l.points[0]}`),
  },
]);

export const stepById = (id) => STEPS.find((s) => s.id === id) || null;
export const LESSON_COUNT = STEPS.filter((s) => s.kind === 'lesson').length;

// Сколько нужно, чтобы урок засчитался.
export const PASS = 0.7;
export const isPassed = (rec) => !!(rec && rec.passed);

// С какого урока начать по уровню из входного теста. Пропущенные остаются доступными.
const START_OF = { 'A0-A1': 'l1', 'A2-B1': 'l14', 'B2+': 'l25' };
export const startFor = (level) => START_OF[level] || 'l1';

// Следующий шаг: первый непройденный с точки старта, потом — первый непройденный вообще.
export function nextStep(progress, level) {
  const done = (progress && progress.done) || {};
  const startId = (progress && progress.start) || startFor(level);
  const from = Math.max(0, STEPS.findIndex((s) => s.id === startId));
  return STEPS.slice(from).find((s) => !isPassed(done[s.id]))
    || STEPS.find((s) => !isPassed(done[s.id]))
    || null;
}

// Отметка урока. Чистая функция: лучший результат сохраняется, «пройдено» не теряется.
export function recordResult(progress, id, correct, total, now = Date.now()) {
  const p = { start: '', done: {}, ...(progress || {}) };
  const pct = total ? correct / total : 0;
  const prev = p.done[id];
  const passed = pct >= PASS || isPassed(prev);
  const best = prev && prev.pct > pct ? prev : { score: `${correct}/${total}`, pct };
  return {
    ...p,
    done: { ...p.done, [id]: { ...best, passed, date: now, tries: ((prev && prev.tries) || 0) + 1 } },
    updatedAt: now,
  };
}

export function unitStats(progress, unit) {
  const done = (progress && progress.done) || {};
  const steps = STEPS.filter((s) => s.unit === unit.n);
  return { passed: steps.filter((s) => isPassed(done[s.id])).length, total: steps.length };
}

// Слияние прогресса с двух устройств: по каждому уроку — пройденный и лучший результат.
export function mergeTextbook(a, b) {
  if (!a || !b) return a || b;
  const done = { ...b.done };
  for (const [id, ra] of Object.entries(a.done || {})) {
    const rb = done[id];
    if (!rb) { done[id] = ra; continue; }
    const best = (ra.pct || 0) >= (rb.pct || 0) ? ra : rb;
    done[id] = { ...best, passed: !!(ra.passed || rb.passed), tries: Math.max(ra.tries || 0, rb.tries || 0), date: Math.max(ra.date || 0, rb.date || 0) };
  }
  const start = ((a.updatedAt || 0) >= (b.updatedAt || 0) ? a.start : b.start) || a.start || b.start || '';
  return { start, done, updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0) };
}

// Опорный план урока для ИИ (то, что он обязан объяснить). Чистая функция.
export function lessonBrief(step) {
  return [
    `Урок: ${step.title} (${step.es}), уровень ${step.level}.`,
    `Жизненная цель: ${step.goal}`,
    step.vocab ? `Лексика урока: ${step.vocab}.` : '',
    `Грамматическая тема: ${step.kind === 'repaso' ? step.topics.join('; ') : step.topic}.`,
    'Опорные пункты правила (проверены, их нужно раскрыть все, не противоречить им):',
    ...step.points.map((p, i) => `${i + 1}. ${p}`),
  ].filter(Boolean).join('\n');
}
