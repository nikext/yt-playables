/* Potion Sort: all player-facing strings. {n} = a number. */
(function () {
  'use strict';
  var PS = window.PS = window.PS || {};

  PS.STR = {
    en: {
      play: 'Play', levels: 'Levels', tagline: 'Sort the elixirs, one pour at a time.', level: 'Level {n}',
      shelves: ['Herb Cellar', 'Ember Shelf', 'Narrow Nook', 'Fog Cabinet', 'Wax Seal Vault', 'Grand Laboratory'],
      moves: 'Moves', par: 'Par', clear: 'Sorted!', next: 'Next', replay: 'Replay', menu: 'Levels', paused: 'Paused',
      resume: 'Resume', restart: 'Restart', sound: 'Sound', music: 'Music', locked: 'Clear level {n} to unlock',
      noMoves: 'No moves left. Undo or restart.', deadEnd: 'Dead end. Undo or restart.',
      addNone: 'No extra flasks left. Clear new levels to refill.', addUsed: 'One extra flask per level',
      addCap: 'Extra flask added. Max 2 stars.', refill: '+1 extra flask',
      tutPick: 'Tap a flask to pick it up', tutPour: 'Tap another flask to pour',
      tipRule: 'Pour onto the same color or into an empty flask', tipSpare: 'Only one spare flask now. Plan ahead!',
      tipHidden: 'Layers marked ? reveal themselves when uncovered', tipCork: 'The sealed flask opens after {n} pours',
      tipMix: 'Seals and hidden layers, together', finale: 'Every shelf is sorted. Master alchemist!',
      newBest: 'New best!', stars: 'Stars', lockedShelf: 'Locked', of: '{n} left'
    },
    es: {
      play: 'Jugar', levels: 'Niveles', tagline: 'Ordena los elixires, vertido a vertido.', level: 'Nivel {n}',
      shelves: ['Bodega de hierbas', 'Estante de brasas', 'Rincón estrecho', 'Armario de niebla', 'Cripta de lacre', 'Gran laboratorio'],
      moves: 'Movs', par: 'Par', clear: '¡Ordenado!', next: 'Siguiente', replay: 'Repetir', menu: 'Niveles', paused: 'Pausa',
      resume: 'Seguir', restart: 'Reiniciar', sound: 'Sonido', music: 'Música', locked: 'Supera el nivel {n} para abrirlo',
      noMoves: 'No quedan movimientos. Deshaz o reinicia.', deadEnd: 'Callejón sin salida. Deshaz o reinicia.',
      addNone: 'No quedan frascos extra. Supera niveles nuevos.', addUsed: 'Un frasco extra por nivel',
      addCap: 'Frasco extra añadido. Máx. 2 estrellas.', refill: '+1 frasco extra',
      tutPick: 'Toca un frasco para cogerlo', tutPour: 'Toca otro frasco para verter',
      tipRule: 'Vierte sobre el mismo color o en un frasco vacío', tipSpare: 'Solo un frasco libre. ¡Planifica!',
      tipHidden: 'Las capas con ? se revelan al destaparlas', tipCork: 'El frasco sellado se abre tras {n} vertidos',
      tipMix: 'Sellos y capas ocultas, todo junto', finale: 'Todos los estantes en orden. ¡Gran alquimista!',
      newBest: '¡Nuevo récord!', stars: 'Estrellas', lockedShelf: 'Cerrado', of: 'Quedan {n}'
    },
    pt: {
      play: 'Jogar', levels: 'Níveis', tagline: 'Separe os elixires, um despejo por vez.', level: 'Nível {n}',
      shelves: ['Adega de ervas', 'Estante das brasas', 'Canto estreito', 'Armário da névoa', 'Cripta do lacre', 'Grande laboratório'],
      moves: 'Jogadas', par: 'Par', clear: 'Separado!', next: 'Próximo', replay: 'Repetir', menu: 'Níveis', paused: 'Pausado',
      resume: 'Continuar', restart: 'Reiniciar', sound: 'Som', music: 'Música', locked: 'Conclua o nível {n} para abrir',
      noMoves: 'Sem jogadas. Desfaça ou reinicie.', deadEnd: 'Beco sem saída. Desfaça ou reinicie.',
      addNone: 'Sem frascos extras. Conclua níveis novos.', addUsed: 'Um frasco extra por nível',
      addCap: 'Frasco extra adicionado. Máx. 2 estrelas.', refill: '+1 frasco extra',
      tutPick: 'Toque num frasco para pegá-lo', tutPour: 'Toque noutro frasco para despejar',
      tipRule: 'Despeje sobre a mesma cor ou num frasco vazio', tipSpare: 'Só um frasco livre agora. Planeje!',
      tipHidden: 'Camadas com ? se revelam ao ficar no topo', tipCork: 'O frasco lacrado abre após {n} despejos',
      tipMix: 'Lacres e camadas ocultas, juntos', finale: 'Todas as estantes em ordem. Mestre alquimista!',
      newBest: 'Novo recorde!', stars: 'Estrelas', lockedShelf: 'Trancado', of: 'Faltam {n}'
    },
    fr: {
      play: 'Jouer', levels: 'Niveaux', tagline: 'Triez les élixirs, une verse à la fois.', level: 'Niveau {n}',
      shelves: ['Cave aux herbes', 'Étagère des braises', 'Recoin étroit', 'Armoire des brumes', 'Caveau des sceaux', 'Grand laboratoire'],
      moves: 'Coups', par: 'Par', clear: 'Trié !', next: 'Suivant', replay: 'Rejouer', menu: 'Niveaux', paused: 'Pause',
      resume: 'Reprendre', restart: 'Recommencer', sound: 'Son', music: 'Musique', locked: 'Finissez le niveau {n} pour l’ouvrir',
      noMoves: 'Plus aucun coup. Annulez ou recommencez.', deadEnd: 'Impasse. Annulez ou recommencez.',
      addNone: 'Plus de fiole en plus. Finissez de nouveaux niveaux.', addUsed: 'Une fiole en plus par niveau',
      addCap: 'Fiole ajoutée. 2 étoiles max.', refill: '+1 fiole en plus',
      tutPick: 'Touchez une fiole pour la prendre', tutPour: 'Touchez une autre fiole pour verser',
      tipRule: 'Versez sur la même couleur ou dans une fiole vide', tipSpare: 'Une seule fiole libre. Anticipez !',
      tipHidden: 'Les couches ? se révèlent une fois découvertes', tipCork: 'La fiole scellée s’ouvre après {n} verses',
      tipMix: 'Sceaux et couches cachées, ensemble', finale: 'Toutes les étagères sont triées. Maître alchimiste !',
      newBest: 'Nouveau record !', stars: 'Étoiles', lockedShelf: 'Fermé', of: 'Encore {n}'
    },
    de: {
      play: 'Spielen', levels: 'Level', tagline: 'Sortiere die Elixiere, Guss für Guss.', level: 'Level {n}',
      shelves: ['Kräuterkeller', 'Glutregal', 'Enge Nische', 'Nebelschrank', 'Siegelgewölbe', 'Großes Labor'],
      moves: 'Züge', par: 'Par', clear: 'Sortiert!', next: 'Weiter', replay: 'Nochmal', menu: 'Level', paused: 'Pause',
      resume: 'Weiter', restart: 'Neustart', sound: 'Ton', music: 'Musik', locked: 'Schaffe Level {n} zum Freischalten',
      noMoves: 'Keine Züge mehr. Rückgängig oder neu starten.', deadEnd: 'Sackgasse. Rückgängig oder neu starten.',
      addNone: 'Keine Extra-Flaschen mehr. Schaffe neue Level.', addUsed: 'Eine Extra-Flasche pro Level',
      addCap: 'Extra-Flasche dazu. Max. 2 Sterne.', refill: '+1 Extra-Flasche',
      tutPick: 'Tippe eine Flasche an, um sie zu nehmen', tutPour: 'Tippe eine andere an, um zu gießen',
      tipRule: 'Gieße auf dieselbe Farbe oder in eine leere Flasche', tipSpare: 'Nur noch eine freie Flasche. Plane voraus!',
      tipHidden: 'Schichten mit ? zeigen sich, sobald sie oben liegen', tipCork: 'Die versiegelte Flasche öffnet nach {n} Güssen',
      tipMix: 'Siegel und verdeckte Schichten zusammen', finale: 'Alle Regale sortiert. Meister der Alchemie!',
      newBest: 'Neuer Bestwert!', stars: 'Sterne', lockedShelf: 'Gesperrt', of: 'Noch {n}'
    }
  };
})();
