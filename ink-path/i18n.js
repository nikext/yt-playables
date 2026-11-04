/*
 * i18n.js: Ink Path's strings (en, es, pt, fr, de). Text is kept short; icons do most of the work.
 */
(function (root) {
  'use strict';
  var STR = {
    en: {
      play: 'Play', levels: 'Levels', tagline: 'One stroke at a time.', chapters: ['Stone', 'Wind', 'Lantern'],
      cleared: 'Cleared', next: 'Next', replay: 'Replay', resume: 'Resume', retry: 'Retry', paused: 'Paused',
      sound: 'Sound', ink: 'Ink', locked: 'Clear the level before', allDone: 'Every path is drawn. Thank you!',
      lost: 'Lost in the void', stuck: 'The marble stopped', time: 'Too slow', noInk: 'The pot is empty',
      tutDraw: 'Draw a path to the cup', tutGo: 'Then press Go', tutInk: 'Less ink earns more seals',
      tip_mist: 'Ink will not stick in the mist', tip_void: 'Leave the paper and the marble is lost',
      tip_wind: 'Wind pushes the marble', tip_pad: 'Bamboo springs launch the marble',
      tip_screen: 'A fast marble tears paper screens', tip_updraft: 'Rising wind lifts the marble',
      tip_lantern: 'Lanterns start to swing when you press Go', tip_two: 'Every marble needs its own cup',
      hint: 'Hint'
    },
    es: {
      play: 'Jugar', levels: 'Niveles', tagline: 'Un trazo cada vez.', chapters: ['Piedra', 'Viento', 'Farol'],
      cleared: 'Superado', next: 'Siguiente', replay: 'Repetir', resume: 'Seguir', retry: 'Reintentar', paused: 'Pausa',
      sound: 'Sonido', ink: 'Tinta', locked: 'Supera el nivel anterior', allDone: 'Todos los caminos trazados. ¡Gracias!',
      lost: 'Perdida en el vacío', stuck: 'La canica se detuvo', time: 'Demasiado lento', noInk: 'No queda tinta',
      tutDraw: 'Dibuja un camino hasta el cuenco', tutGo: 'Luego pulsa Ir', tutInk: 'Menos tinta, más sellos',
      tip_mist: 'La tinta no se pega en la niebla', tip_void: 'Si sale del papel, la canica se pierde',
      tip_wind: 'El viento empuja la canica', tip_pad: 'Los muelles de bambú lanzan la canica',
      tip_screen: 'Una canica rápida rompe el papel', tip_updraft: 'El viento ascendente eleva la canica',
      tip_lantern: 'Los faroles se mueven al pulsar Ir', tip_two: 'Cada canica necesita su cuenco',
      hint: 'Pista'
    },
    pt: {
      play: 'Jogar', levels: 'Níveis', tagline: 'Um traço de cada vez.', chapters: ['Pedra', 'Vento', 'Lanterna'],
      cleared: 'Concluído', next: 'Próximo', replay: 'Repetir', resume: 'Continuar', retry: 'Tentar de novo', paused: 'Pausado',
      sound: 'Som', ink: 'Tinta', locked: 'Conclua o nível anterior', allDone: 'Todos os caminhos traçados. Obrigado!',
      lost: 'Perdida no vazio', stuck: 'A bolinha parou', time: 'Lento demais', noInk: 'A tinta acabou',
      tutDraw: 'Desenhe um caminho até a tigela', tutGo: 'Depois toque em Ir', tutInk: 'Menos tinta, mais selos',
      tip_mist: 'A tinta não pega na névoa', tip_void: 'Se sair do papel, a bolinha se perde',
      tip_wind: 'O vento empurra a bolinha', tip_pad: 'Molas de bambu lançam a bolinha',
      tip_screen: 'Uma bolinha rápida rasga o papel', tip_updraft: 'O vento que sobe ergue a bolinha',
      tip_lantern: 'As lanternas se movem quando você toca em Ir', tip_two: 'Cada bolinha precisa da sua tigela',
      hint: 'Dica'
    },
    fr: {
      play: 'Jouer', levels: 'Niveaux', tagline: 'Un trait à la fois.', chapters: ['Pierre', 'Vent', 'Lanterne'],
      cleared: 'Réussi', next: 'Suivant', replay: 'Rejouer', resume: 'Reprendre', retry: 'Réessayer', paused: 'Pause',
      sound: 'Son', ink: 'Encre', locked: 'Finissez le niveau précédent', allDone: 'Tous les chemins sont tracés. Merci !',
      lost: 'Perdue dans le vide', stuck: 'La bille s’est arrêtée', time: 'Trop lent', noInk: 'Plus d’encre',
      tutDraw: 'Tracez un chemin jusqu’au bol', tutGo: 'Puis touchez Go', tutInk: 'Moins d’encre, plus de sceaux',
      tip_mist: 'L’encre ne tient pas dans la brume', tip_void: 'Hors du papier, la bille est perdue',
      tip_wind: 'Le vent pousse la bille', tip_pad: 'Les ressorts de bambou lancent la bille',
      tip_screen: 'Une bille rapide déchire le papier', tip_updraft: 'Le vent ascendant soulève la bille',
      tip_lantern: 'Les lanternes bougent dès que vous touchez Go', tip_two: 'Chaque bille a besoin de son bol',
      hint: 'Indice'
    },
    de: {
      play: 'Spielen', levels: 'Level', tagline: 'Ein Strich nach dem anderen.', chapters: ['Stein', 'Wind', 'Laterne'],
      cleared: 'Geschafft', next: 'Weiter', replay: 'Nochmal', resume: 'Weiter', retry: 'Neu', paused: 'Pause',
      sound: 'Ton', ink: 'Tinte', locked: 'Schaffe zuerst das Level davor', allDone: 'Alle Wege sind gezogen. Danke!',
      lost: 'Ins Leere gefallen', stuck: 'Die Murmel liegt still', time: 'Zu langsam', noInk: 'Die Tinte ist leer',
      tutDraw: 'Zeichne einen Weg zur Schale', tutGo: 'Dann tippe auf Los', tutInk: 'Weniger Tinte, mehr Siegel',
      tip_mist: 'Im Nebel hält keine Tinte', tip_void: 'Verlässt die Murmel das Papier, ist sie weg',
      tip_wind: 'Wind schiebt die Murmel', tip_pad: 'Bambusfedern schleudern die Murmel',
      tip_screen: 'Eine schnelle Murmel zerreißt Papier', tip_updraft: 'Aufwind hebt die Murmel',
      tip_lantern: 'Laternen schwingen, sobald du Los tippst', tip_two: 'Jede Murmel braucht ihre Schale',
      hint: 'Tipp'
    }
  };
  root.InkI18n = {
    STR: STR,
    pick: function (tag) {
      var k = String(tag || 'en').slice(0, 2).toLowerCase();
      return STR[k] ? k : 'en';
    }
  };
})(this);
