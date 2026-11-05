/*
 * i18n.js: Putt Garden's strings (en, es, pt, fr, de). Text is kept short; icons do most of the work.
 */
(function (root) {
  'use strict';
  var STR = {
    en: {
      tagline: 'A papercut mini golf garden', play: 'Play', courses: 'Courses', scorecard: 'Scorecard',
      courseNames: ['Meadow', 'Desert Garden', 'Lagoon'],
      hole: 'Hole', par: 'Par', strokes: 'Strokes', total: 'Total', stars: 'Stars', best: 'Best',
      resume: 'Resume', restart: 'Restart hole', sound: 'Sound', paused: 'Paused', next: 'Next hole', retry: 'Retry',
      nextCourse: 'Next course', replayCourse: 'Play again', locked: 'Finish the hole before', lockedCourse: 'Finish the course before',
      courseDone: 'Course complete!', newBest: 'New best!', outOfStrokes: 'Out of strokes', penalty: '+1 stroke',
      terms: { ace: 'Hole in one!', '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Double bogey' },
      over: 'over par', under: 'under par', even: 'even',
      tutDrag: 'Drag back to aim', tutRelease: 'Let go to putt', keys: '← → aim · ↑ ↓ power · Space putt',
      tips: {
        bank: 'Bounce the ball off the walls', curve: 'Curved walls guide the ball around', posts: 'Play around the stones',
        rough: 'Tall grass slows the ball', slope: 'The arrows show which way the ground slopes', sand: 'Sand stops the ball quickly',
        bumper: 'Flowers kick the ball away', gate: 'Gates only open one way', slider: 'Stone blocks slide: time your putt',
        water: 'Water costs a stroke', blade: 'Mind the turning windmill', pipe: 'Pipes carry the ball across'
      },
      allDone: 'Every hole played. Thanks!'
    },
    es: {
      tagline: 'Un jardín de minigolf de papel', play: 'Jugar', courses: 'Campos', scorecard: 'Tarjeta',
      courseNames: ['Pradera', 'Jardín del desierto', 'Laguna'],
      hole: 'Hoyo', par: 'Par', strokes: 'Golpes', total: 'Total', stars: 'Estrellas', best: 'Mejor',
      resume: 'Seguir', restart: 'Reiniciar hoyo', sound: 'Sonido', paused: 'Pausa', next: 'Siguiente', retry: 'Repetir',
      nextCourse: 'Siguiente campo', replayCourse: 'Jugar otra vez', locked: 'Termina el hoyo anterior', lockedCourse: 'Termina el campo anterior',
      courseDone: '¡Campo completado!', newBest: '¡Nuevo récord!', outOfStrokes: 'Sin golpes', penalty: '+1 golpe',
      terms: { ace: '¡Hoyo en uno!', '-3': '¡Albatros!', '-2': '¡Águila!', '-1': '¡Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Doble bogey' },
      over: 'sobre par', under: 'bajo par', even: 'par',
      tutDrag: 'Arrastra hacia atrás para apuntar', tutRelease: 'Suelta para golpear', keys: '← → apuntar · ↑ ↓ fuerza · Espacio golpear',
      tips: {
        bank: 'Haz rebotar la bola en las paredes', curve: 'Las paredes curvas guían la bola', posts: 'Esquiva las piedras',
        rough: 'La hierba alta frena la bola', slope: 'Las flechas muestran la pendiente', sand: 'La arena frena la bola enseguida',
        bumper: 'Las flores rechazan la bola', gate: 'Las puertas solo abren en un sentido', slider: 'Los bloques se deslizan: elige el momento',
        water: 'El agua cuesta un golpe', blade: 'Cuidado con el molino', pipe: 'Las tuberías llevan la bola al otro lado'
      },
      allDone: '¡Todos los hoyos jugados. Gracias!'
    },
    pt: {
      tagline: 'Um jardim de minigolfe de papel', play: 'Jogar', courses: 'Campos', scorecard: 'Cartão',
      courseNames: ['Prado', 'Jardim do deserto', 'Lagoa'],
      hole: 'Buraco', par: 'Par', strokes: 'Tacadas', total: 'Total', stars: 'Estrelas', best: 'Melhor',
      resume: 'Continuar', restart: 'Reiniciar buraco', sound: 'Som', paused: 'Pausado', next: 'Próximo', retry: 'Repetir',
      nextCourse: 'Próximo campo', replayCourse: 'Jogar de novo', locked: 'Termine o buraco anterior', lockedCourse: 'Termine o campo anterior',
      courseDone: 'Campo concluído!', newBest: 'Novo recorde!', outOfStrokes: 'Sem tacadas', penalty: '+1 tacada',
      terms: { ace: 'Hole in one!', '-3': 'Albatroz!', '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Duplo bogey' },
      over: 'acima do par', under: 'abaixo do par', even: 'no par',
      tutDrag: 'Arraste para trás para mirar', tutRelease: 'Solte para tacar', keys: '← → mirar · ↑ ↓ força · Espaço tacar',
      tips: {
        bank: 'Faça a bola quicar nas paredes', curve: 'Paredes curvas guiam a bola', posts: 'Desvie das pedras',
        rough: 'A grama alta freia a bola', slope: 'As setas mostram a inclinação', sand: 'A areia para a bola rápido',
        bumper: 'As flores rebatem a bola', gate: 'Os portões só abrem para um lado', slider: 'Os blocos deslizam: escolha a hora',
        water: 'A água custa uma tacada', blade: 'Cuidado com o moinho', pipe: 'Os canos levam a bola para o outro lado'
      },
      allDone: 'Todos os buracos jogados. Obrigado!'
    },
    fr: {
      tagline: 'Un jardin de minigolf en papier', play: 'Jouer', courses: 'Parcours', scorecard: 'Carte',
      courseNames: ['Prairie', 'Jardin du désert', 'Lagune'],
      hole: 'Trou', par: 'Par', strokes: 'Coups', total: 'Total', stars: 'Étoiles', best: 'Record',
      resume: 'Reprendre', restart: 'Rejouer le trou', sound: 'Son', paused: 'Pause', next: 'Suivant', retry: 'Rejouer',
      nextCourse: 'Parcours suivant', replayCourse: 'Rejouer', locked: 'Finissez le trou précédent', lockedCourse: 'Finissez le parcours précédent',
      courseDone: 'Parcours terminé !', newBest: 'Nouveau record !', outOfStrokes: 'Plus de coups', penalty: '+1 coup',
      terms: { ace: 'Trou en un !', '-3': 'Albatros !', '-2': 'Eagle !', '-1': 'Birdie !', '0': 'Par', '1': 'Bogey', '2': 'Double bogey' },
      over: 'au-dessus du par', under: 'sous le par', even: 'au par',
      tutDrag: 'Tirez en arrière pour viser', tutRelease: 'Relâchez pour putter', keys: '← → viser · ↑ ↓ force · Espace putter',
      tips: {
        bank: 'Faites rebondir la balle sur les murs', curve: 'Les murs courbes guident la balle', posts: 'Contournez les pierres',
        rough: 'L’herbe haute freine la balle', slope: 'Les flèches montrent la pente', sand: 'Le sable arrête vite la balle',
        bumper: 'Les fleurs renvoient la balle', gate: 'Les portillons ne s’ouvrent que dans un sens', slider: 'Les blocs glissent : choisissez le moment',
        water: 'L’eau coûte un coup', blade: 'Attention au moulin', pipe: 'Les tuyaux transportent la balle'
      },
      allDone: 'Tous les trous sont joués. Merci !'
    },
    de: {
      tagline: 'Ein Minigolf-Garten aus Papier', play: 'Spielen', courses: 'Plätze', scorecard: 'Scorekarte',
      courseNames: ['Wiese', 'Wüstengarten', 'Lagune'],
      hole: 'Bahn', par: 'Par', strokes: 'Schläge', total: 'Gesamt', stars: 'Sterne', best: 'Bestwert',
      resume: 'Weiter', restart: 'Bahn neu starten', sound: 'Ton', paused: 'Pause', next: 'Nächste Bahn', retry: 'Nochmal',
      nextCourse: 'Nächster Platz', replayCourse: 'Nochmal spielen', locked: 'Spiele zuerst die Bahn davor', lockedCourse: 'Spiele zuerst den Platz davor',
      courseDone: 'Platz geschafft!', newBest: 'Neuer Bestwert!', outOfStrokes: 'Keine Schläge mehr', penalty: '+1 Schlag',
      terms: { ace: 'Hole-in-One!', '-3': 'Albatros!', '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Doppelbogey' },
      over: 'über Par', under: 'unter Par', even: 'Par',
      tutDrag: 'Zum Zielen nach hinten ziehen', tutRelease: 'Loslassen zum Putten', keys: '← → zielen · ↑ ↓ Kraft · Leertaste putten',
      tips: {
        bank: 'Spiele über die Banden', curve: 'Runde Wände lenken den Ball', posts: 'Spiele um die Steine herum',
        rough: 'Hohes Gras bremst den Ball', slope: 'Die Pfeile zeigen das Gefälle', sand: 'Sand bremst den Ball stark',
        bumper: 'Blumen schleudern den Ball weg', gate: 'Tore öffnen nur in eine Richtung', slider: 'Steinblöcke gleiten: Timing zählt',
        water: 'Wasser kostet einen Schlag', blade: 'Achtung, Windmühle', pipe: 'Rohre bringen den Ball hinüber'
      },
      allDone: 'Alle Bahnen gespielt. Danke!'
    }
  };
  root.PuttI18n = {
    STR: STR,
    pick: function (tag) {
      var k = String(tag || 'en').slice(0, 2).toLowerCase();
      return STR[k] ? k : 'en';
    }
  };
})(this);
