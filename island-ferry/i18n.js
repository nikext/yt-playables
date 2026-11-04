/* Island Ferry: all player-facing strings. {n} = number, {g} = inline goods icon. */
(function () {
  'use strict';
  var IF = window.IF = window.IF || {};

  var D = {
    en: {
      play: 'Play', contDay: 'Continue · Day {n}', newRun: 'New run', sure: 'Tap again to start over',
      tag: 'Cozy cargo routes between islands', day: 'Day {n}', paused: 'Paused', resume: 'Resume',
      soundOn: 'Sound: On', soundOff: 'Sound: Off', quit: 'Quit to menu', tapCont: 'Tap to continue',
      tut1: 'Drag from the {g} island to the island asking for {g}',
      tut2: 'Your ferry carries the cargo. Deliver before the ring runs out!',
      tut3: 'Tap a route to select or remove it.',
      multi: 'Tip: drag across several islands for a multi-stop route',
      noFerry: 'No free ferry. Remove a route first.', dupRoute: 'That route already exists',
      newIsland: 'A new island joined the trade!', dayDone: 'Day {n} complete', pick: 'Pick one upgrade',
      reroll: 'Reroll', gameOver: 'Out of hearts', newBest: 'New best!', again: 'Play again', menu: 'Menu',
      dayReached: 'Reached day {n}', best: 'Best', deliveries: 'Deliveries', coins: 'Coins',
      remove: 'Remove', tomorrow: 'Tomorrow', tapSkip: 'Tap to continue',
      c_ferry: '+1 Ferry', d_ferry: 'One more route on the water.',
      c_speed: 'Swift Hulls', d_speed: 'Ferries sail 20% faster.',
      c_hold: 'Bigger Hold', d_hold: 'Each ferry carries +1 crate.',
      c_calm: 'Calm Harbor', d_calm: '+60% patience at the {g} island.',
      c_light: 'Lighthouse', d_light: "See tomorrow's island early. +10% patience.",
      c_heart: 'Good Name', d_heart: '+1 max heart and refill one.',
      c_docks: 'Busy Docks', d_docks: 'Islands make goods 40% faster.',
      c_crew: 'Quick Crews', d_crew: 'Loading and unloading is 40% faster.'
    },
    es: {
      play: 'Jugar', contDay: 'Continuar · Día {n}', newRun: 'Nueva partida', sure: 'Toca otra vez para empezar',
      tag: 'Rutas de carga entre islas', day: 'Día {n}', paused: 'Pausa', resume: 'Seguir',
      soundOn: 'Sonido: sí', soundOff: 'Sonido: no', quit: 'Salir al menú', tapCont: 'Toca para continuar',
      tut1: 'Arrastra desde la isla de {g} hasta la isla que pide {g}',
      tut2: 'Tu ferri lleva la carga. ¡Entrega antes de que se acabe el anillo!',
      tut3: 'Toca una ruta para elegirla o quitarla.',
      multi: 'Consejo: pasa por varias islas para crear una ruta con paradas',
      noFerry: 'No hay ferris libres. Quita una ruta.', dupRoute: 'Esa ruta ya existe',
      newIsland: '¡Una nueva isla se une al comercio!', dayDone: 'Día {n} completado', pick: 'Elige una mejora',
      reroll: 'Cambiar', gameOver: 'Sin corazones', newBest: '¡Nuevo récord!', again: 'Jugar otra vez', menu: 'Menú',
      dayReached: 'Llegaste al día {n}', best: 'Récord', deliveries: 'Entregas', coins: 'Monedas',
      remove: 'Quitar', tomorrow: 'Mañana', tapSkip: 'Toca para seguir',
      c_ferry: '+1 ferri', d_ferry: 'Una ruta más en el agua.',
      c_speed: 'Cascos veloces', d_speed: 'Los ferris navegan un 20% más rápido.',
      c_hold: 'Bodega grande', d_hold: 'Cada ferri lleva +1 caja.',
      c_calm: 'Puerto tranquilo', d_calm: '+60% de paciencia en la isla de {g}.',
      c_light: 'Faro', d_light: 'Ve la isla de mañana. +10% de paciencia.',
      c_heart: 'Buena fama', d_heart: '+1 corazón máximo y recupera uno.',
      c_docks: 'Muelles activos', d_docks: 'Las islas producen un 40% más rápido.',
      c_crew: 'Tripulación ágil', d_crew: 'Cargar y descargar es un 40% más rápido.'
    },
    pt: {
      play: 'Jogar', contDay: 'Continuar · Dia {n}', newRun: 'Nova partida', sure: 'Toque de novo para recomeçar',
      tag: 'Rotas de carga entre ilhas', day: 'Dia {n}', paused: 'Pausado', resume: 'Continuar',
      soundOn: 'Som: ligado', soundOff: 'Som: desligado', quit: 'Sair para o menu', tapCont: 'Toque para continuar',
      tut1: 'Arraste da ilha de {g} até a ilha que pede {g}',
      tut2: 'Sua balsa leva a carga. Entregue antes que o anel acabe!',
      tut3: 'Toque numa rota para escolher ou remover.',
      multi: 'Dica: passe por várias ilhas para criar uma rota com paradas',
      noFerry: 'Nenhuma balsa livre. Remova uma rota.', dupRoute: 'Essa rota já existe',
      newIsland: 'Uma nova ilha entrou no comércio!', dayDone: 'Dia {n} concluído', pick: 'Escolha uma melhoria',
      reroll: 'Trocar', gameOver: 'Sem corações', newBest: 'Novo recorde!', again: 'Jogar de novo', menu: 'Menu',
      dayReached: 'Chegou ao dia {n}', best: 'Recorde', deliveries: 'Entregas', coins: 'Moedas',
      remove: 'Remover', tomorrow: 'Amanhã', tapSkip: 'Toque para seguir',
      c_ferry: '+1 balsa', d_ferry: 'Mais uma rota na água.',
      c_speed: 'Cascos velozes', d_speed: 'As balsas navegam 20% mais rápido.',
      c_hold: 'Porão maior', d_hold: 'Cada balsa leva +1 caixa.',
      c_calm: 'Porto calmo', d_calm: '+60% de paciência na ilha de {g}.',
      c_light: 'Farol', d_light: 'Veja a ilha de amanhã. +10% de paciência.',
      c_heart: 'Boa fama', d_heart: '+1 coração máximo e recupera um.',
      c_docks: 'Docas ativas', d_docks: 'As ilhas produzem 40% mais rápido.',
      c_crew: 'Tripulação ágil', d_crew: 'Carregar e descarregar fica 40% mais rápido.'
    },
    fr: {
      play: 'Jouer', contDay: 'Continuer · Jour {n}', newRun: 'Nouvelle partie', sure: 'Touchez encore pour recommencer',
      tag: 'Routes de fret entre les îles', day: 'Jour {n}', paused: 'Pause', resume: 'Reprendre',
      soundOn: 'Son : oui', soundOff: 'Son : non', quit: 'Quitter vers le menu', tapCont: 'Touchez pour continuer',
      tut1: "Glissez de l'île {g} vers l'île qui demande {g}",
      tut2: "Le ferry transporte la cargaison. Livrez avant la fin de l'anneau !",
      tut3: 'Touchez une route pour la choisir ou la retirer.',
      multi: 'Astuce : passez par plusieurs îles pour une route à escales',
      noFerry: 'Aucun ferry libre. Retirez une route.', dupRoute: 'Cette route existe déjà',
      newIsland: 'Une nouvelle île rejoint le commerce !', dayDone: 'Jour {n} terminé', pick: 'Choisissez une amélioration',
      reroll: 'Changer', gameOver: 'Plus de cœurs', newBest: 'Nouveau record !', again: 'Rejouer', menu: 'Menu',
      dayReached: 'Jour {n} atteint', best: 'Record', deliveries: 'Livraisons', coins: 'Pièces',
      remove: 'Retirer', tomorrow: 'Demain', tapSkip: 'Touchez pour continuer',
      c_ferry: '+1 ferry', d_ferry: "Une route de plus sur l'eau.",
      c_speed: 'Coques rapides', d_speed: 'Les ferries vont 20 % plus vite.',
      c_hold: 'Grande cale', d_hold: 'Chaque ferry porte +1 caisse.',
      c_calm: 'Port paisible', d_calm: "+60 % de patience sur l'île {g}.",
      c_light: 'Phare', d_light: "Voyez l'île de demain. +10 % de patience.",
      c_heart: 'Bonne réputation', d_heart: '+1 cœur max et en rend un.',
      c_docks: 'Quais animés', d_docks: 'Les îles produisent 40 % plus vite.',
      c_crew: 'Équipage vif', d_crew: 'Charger et décharger 40 % plus vite.'
    },
    de: {
      play: 'Spielen', contDay: 'Weiter · Tag {n}', newRun: 'Neues Spiel', sure: 'Nochmal tippen zum Neustart',
      tag: 'Frachtrouten zwischen Inseln', day: 'Tag {n}', paused: 'Pause', resume: 'Weiter',
      soundOn: 'Ton: an', soundOff: 'Ton: aus', quit: 'Zum Menü', tapCont: 'Tippen zum Fortsetzen',
      tut1: 'Ziehe von der {g}-Insel zur Insel, die {g} braucht',
      tut2: 'Deine Fähre bringt die Ware. Liefere, bevor der Ring abläuft!',
      tut3: 'Tippe auf eine Route, um sie zu wählen oder zu entfernen.',
      multi: 'Tipp: Zieh über mehrere Inseln für eine Route mit Halten',
      noFerry: 'Keine freie Fähre. Entferne eine Route.', dupRoute: 'Diese Route gibt es schon',
      newIsland: 'Eine neue Insel handelt mit!', dayDone: 'Tag {n} geschafft', pick: 'Wähle ein Upgrade',
      reroll: 'Neu ziehen', gameOver: 'Keine Herzen mehr', newBest: 'Neuer Rekord!', again: 'Nochmal', menu: 'Menü',
      dayReached: 'Tag {n} erreicht', best: 'Rekord', deliveries: 'Lieferungen', coins: 'Münzen',
      remove: 'Entfernen', tomorrow: 'Morgen', tapSkip: 'Tippen zum Fortfahren',
      c_ferry: '+1 Fähre', d_ferry: 'Eine Route mehr auf dem Wasser.',
      c_speed: 'Schnelle Rümpfe', d_speed: 'Fähren fahren 20 % schneller.',
      c_hold: 'Großer Laderaum', d_hold: 'Jede Fähre trägt +1 Kiste.',
      c_calm: 'Ruhiger Hafen', d_calm: '+60 % Geduld auf der {g}-Insel.',
      c_light: 'Leuchtturm', d_light: 'Sieh die Insel von morgen. +10 % Geduld.',
      c_heart: 'Guter Ruf', d_heart: '+1 max. Herz und eins zurück.',
      c_docks: 'Fleißige Docks', d_docks: 'Inseln produzieren 40 % schneller.',
      c_crew: 'Flinke Crew', d_crew: 'Laden und Entladen 40 % schneller.'
    }
  };

  var lang = 'en';
  IF.setLang = function (tag) {
    var l = String(tag || 'en').toLowerCase().slice(0, 2);
    lang = D[l] ? l : 'en';
  };
  IF.getLang = function () { return lang; };
  IF.t = function (k, n) {
    var s = D[lang][k];
    if (s == null) s = D.en[k];
    if (s == null) return k;
    if (n != null) s = s.replace('{n}', n);
    return s;
  };
  IF.setLang(navigator.language);
})();
