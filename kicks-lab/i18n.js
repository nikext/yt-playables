/* Kicks Lab: all player-facing strings. {n} {m} = numbers, {x} = a name. */
(function () {
  'use strict';
  var KL = window.KL = window.KL || {};

  var D = {
    en: {
      tag: 'Custom sneaker studio', play: 'Open the studio', cont: 'Continue · Day {n}', fresh: 'New studio', sure: 'Tap again to start fresh',
      day: 'Day {n}', done: 'Done', next: 'Next client', paused: 'Paused', resume: 'Resume', soundOn: 'Sound: On', soundOff: 'Sound: Off', quit: 'Quit to menu',
      t0: 'Paint', t1: 'Pattern', t2: 'Sticker', t3: 'Laces', t4: 'Shoe',
      h0: 'Tap a zone to paint it', h1: 'Pick a pattern, then tap a zone', h2: 'Drag a sticker onto the shoe', h3: 'Pick a lace style', h4: 'Pick a silhouette',
      tut1: 'Pick the pink ink', tut2: 'Tap a zone to paint it', tut3: 'Now add the blue', tut4: 'Open the stickers', tut5: 'Drag the star onto the side panel', tut6: 'Matches the order? Tap Done!',
      tutR: 'Each check is a point of hype. Fast + good colors = more.',
      r_color: 'Use this ink somewhere', r_zone: 'Paint the {x} this ink', r_vibe: '{x} vibe: mostly these inks', r_pat: 'Spray this pattern', r_stk: 'Add this sticker',
      r_ban: 'Not this ink, anywhere', r_mood: 'Match the mood board', r_lace: 'Use this lace style', r_sil: 'Make it on this shoe', r_keep: 'Remix: keep the other zones as they are',
      z0: 'upper', z1: 'side panel', z2: 'toe cap', z3: 'heel', z4: 'collar', z5: 'laces', z6: 'midsole', z7: 'sole',
      v0: 'Retro', v1: 'Night', v2: 'Beach', v3: 'Forest', v4: 'Candy', v5: 'Mono',
      p0: 'Solid', p1: 'Fade', p2: 'Speckle', p3: 'Stripes', p4: 'Check', p5: 'Camo',
      s0: 'Star', s1: 'Bolt', s2: 'Wave', s3: 'Flame', s4: 'Eye', s5: 'Smiley',
      l0: 'Classic', l1: 'Cross', l2: 'Ladder', l3: 'Chunky',
      k0: 'Runner', k1: 'High-top', k2: 'Trail', k3: 'Slip-on',
      hype: 'HYPE', harmony: 'Harmony', speed: 'Speed', booth: 'Booth', pin: 'Pin', pinned: 'Pinned!',
      remix: 'Remix', picky: 'Picky client', dayDone: 'Day {n} done', shop: 'Shop', nextDay: 'Open day {n}',
      soldOut: 'You own everything. Legend.', broke: 'Not enough cash', locked: 'Unlock it in the shop',
      i_ink: 'Ink pack', i_booth: 'Spray booth', i_booth2: 'Pro booth', i_window: 'Display window',
      d_ink: '2 new riso inks', d_pat: 'New spray pattern', d_stk: 'New sticker', d_lace: 'New lace style', d_sil: 'New silhouette',
      d_booth: '+5 hype on every pair', d_window: 'Pickier clients, +40% pay',
      wall: 'Studio wall', wallEmpty: 'Pin your best pairs from the result screen.', back: 'Back',
      tier: 'Rep tier {n}! Tougher orders, bigger pay.', rep: 'Rep', kicks: 'Pairs', tipLook: 'Tap an order icon to see what it means',
      wallFull: 'Wall full: replaced the oldest pin', earned: 'Today', clientN: 'Client {n}/{m}', avg: 'Avg hype',
      max3: 'Max 3 stickers. Drag one off to remove it.'
    },
    es: {
      tag: 'Taller de zapatillas custom', play: 'Abrir el taller', cont: 'Continuar · Día {n}', fresh: 'Nuevo taller', sure: 'Toca otra vez para empezar de cero',
      day: 'Día {n}', done: 'Listo', next: 'Siguiente', paused: 'Pausa', resume: 'Seguir', soundOn: 'Sonido: sí', soundOff: 'Sonido: no', quit: 'Salir al menú',
      t0: 'Pintar', t1: 'Patrón', t2: 'Pegatina', t3: 'Cordones', t4: 'Modelo',
      h0: 'Toca una zona para pintarla', h1: 'Elige un patrón y toca una zona', h2: 'Arrastra una pegatina a la zapatilla', h3: 'Elige un estilo de cordones', h4: 'Elige un modelo',
      tut1: 'Elige la tinta rosa', tut2: 'Toca una zona para pintarla', tut3: 'Ahora añade el azul', tut4: 'Abre las pegatinas', tut5: 'Arrastra la estrella al panel lateral', tut6: '¿Cumple el pedido? ¡Toca Listo!',
      tutR: 'Cada acierto suma hype. Rápido + buenos colores = más.',
      r_color: 'Usa esta tinta en algún sitio', r_zone: 'Pinta {x} de esta tinta', r_vibe: 'Estilo {x}: sobre todo estas tintas', r_pat: 'Aplica este patrón', r_stk: 'Añade esta pegatina',
      r_ban: 'Nada de esta tinta', r_mood: 'Imita el moodboard', r_lace: 'Usa estos cordones', r_sil: 'Hazla en este modelo', r_keep: 'Remix: deja igual las demás zonas',
      z0: 'el empeine', z1: 'el panel lateral', z2: 'la puntera', z3: 'el talón', z4: 'el cuello', z5: 'los cordones', z6: 'la mediasuela', z7: 'la suela',
      v0: 'Retro', v1: 'Noche', v2: 'Playa', v3: 'Bosque', v4: 'Dulce', v5: 'Mono',
      p0: 'Liso', p1: 'Degradado', p2: 'Moteado', p3: 'Rayas', p4: 'Cuadros', p5: 'Camuflaje',
      s0: 'Estrella', s1: 'Rayo', s2: 'Ola', s3: 'Llama', s4: 'Ojo', s5: 'Carita',
      l0: 'Clásicos', l1: 'Cruzados', l2: 'Escalera', l3: 'Gruesos',
      k0: 'Runner', k1: 'Bota alta', k2: 'Trail', k3: 'Slip-on',
      hype: 'HYPE', harmony: 'Armonía', speed: 'Rapidez', booth: 'Cabina', pin: 'Fijar', pinned: '¡Fijada!',
      remix: 'Remix', picky: 'Cliente exigente', dayDone: 'Día {n} terminado', shop: 'Tienda', nextDay: 'Abrir día {n}',
      soldOut: 'Lo tienes todo. Leyenda.', broke: 'No te alcanza', locked: 'Desbloquéalo en la tienda',
      i_ink: 'Pack de tintas', i_booth: 'Cabina de spray', i_booth2: 'Cabina pro', i_window: 'Escaparate',
      d_ink: '2 tintas riso nuevas', d_pat: 'Nuevo patrón', d_stk: 'Nueva pegatina', d_lace: 'Nuevos cordones', d_sil: 'Nuevo modelo',
      d_booth: '+5 de hype en cada par', d_window: 'Clientes exigentes, +40% de pago',
      wall: 'Muro del taller', wallEmpty: 'Fija tus mejores pares desde el resultado.', back: 'Volver',
      tier: '¡Nivel {n}! Pedidos más difíciles, mejor paga.', rep: 'Rep', kicks: 'Pares', tipLook: 'Toca un icono del pedido para ver qué significa',
      wallFull: 'Muro lleno: se quitó el más antiguo', earned: 'Hoy', clientN: 'Cliente {n}/{m}', avg: 'Hype medio',
      max3: 'Máximo 3 pegatinas. Arrastra una fuera para quitarla.'
    },
    pt: {
      tag: 'Estúdio de tênis custom', play: 'Abrir o estúdio', cont: 'Continuar · Dia {n}', fresh: 'Novo estúdio', sure: 'Toque de novo para recomeçar',
      day: 'Dia {n}', done: 'Pronto', next: 'Próximo', paused: 'Pausado', resume: 'Continuar', soundOn: 'Som: ligado', soundOff: 'Som: desligado', quit: 'Sair para o menu',
      t0: 'Pintar', t1: 'Padrão', t2: 'Adesivo', t3: 'Cadarços', t4: 'Modelo',
      h0: 'Toque numa área para pintar', h1: 'Escolha um padrão e toque numa área', h2: 'Arraste um adesivo para o tênis', h3: 'Escolha um cadarço', h4: 'Escolha um modelo',
      tut1: 'Escolha a tinta rosa', tut2: 'Toque numa área para pintar', tut3: 'Agora coloque o azul', tut4: 'Abra os adesivos', tut5: 'Arraste a estrela para o painel lateral', tut6: 'Bate com o pedido? Toque em Pronto!',
      tutR: 'Cada acerto vale hype. Rápido + boas cores = mais.',
      r_color: 'Use esta tinta em algum lugar', r_zone: 'Pinte {x} com esta tinta', r_vibe: 'Estilo {x}: quase só estas tintas', r_pat: 'Aplique este padrão', r_stk: 'Coloque este adesivo',
      r_ban: 'Nada desta tinta', r_mood: 'Combine com o moodboard', r_lace: 'Use este cadarço', r_sil: 'Faça neste modelo', r_keep: 'Remix: mantenha as outras áreas',
      z0: 'o cabedal', z1: 'o painel lateral', z2: 'a biqueira', z3: 'o calcanhar', z4: 'a gola', z5: 'os cadarços', z6: 'a entressola', z7: 'a sola',
      v0: 'Retrô', v1: 'Noite', v2: 'Praia', v3: 'Floresta', v4: 'Doce', v5: 'Mono',
      p0: 'Liso', p1: 'Degradê', p2: 'Pintinhas', p3: 'Listras', p4: 'Xadrez', p5: 'Camuflado',
      s0: 'Estrela', s1: 'Raio', s2: 'Onda', s3: 'Chama', s4: 'Olho', s5: 'Carinha',
      l0: 'Clássico', l1: 'Cruzado', l2: 'Escada', l3: 'Grosso',
      k0: 'Runner', k1: 'Cano alto', k2: 'Trilha', k3: 'Slip-on',
      hype: 'HYPE', harmony: 'Harmonia', speed: 'Rapidez', booth: 'Cabine', pin: 'Fixar', pinned: 'Fixado!',
      remix: 'Remix', picky: 'Cliente exigente', dayDone: 'Dia {n} concluído', shop: 'Loja', nextDay: 'Abrir dia {n}',
      soldOut: 'Você tem tudo. Lenda.', broke: 'Dinheiro insuficiente', locked: 'Desbloqueie na loja',
      i_ink: 'Pacote de tintas', i_booth: 'Cabine de spray', i_booth2: 'Cabine pro', i_window: 'Vitrine',
      d_ink: '2 tintas riso novas', d_pat: 'Novo padrão', d_stk: 'Novo adesivo', d_lace: 'Novo cadarço', d_sil: 'Novo modelo',
      d_booth: '+5 de hype em cada par', d_window: 'Clientes exigentes, +40% de pagamento',
      wall: 'Mural do estúdio', wallEmpty: 'Fixe seus melhores pares na tela de resultado.', back: 'Voltar',
      tier: 'Nível {n}! Pedidos mais difíceis, pagamento maior.', rep: 'Rep', kicks: 'Pares', tipLook: 'Toque num ícone do pedido para ver o que significa',
      wallFull: 'Mural cheio: o mais antigo saiu', earned: 'Hoje', clientN: 'Cliente {n}/{m}', avg: 'Hype médio',
      max3: 'Máximo 3 adesivos. Arraste um para fora para tirar.'
    },
    fr: {
      tag: 'Atelier de sneakers custom', play: "Ouvrir l'atelier", cont: 'Continuer · Jour {n}', fresh: 'Nouvel atelier', sure: 'Touchez encore pour tout recommencer',
      day: 'Jour {n}', done: 'Fini', next: 'Client suivant', paused: 'Pause', resume: 'Reprendre', soundOn: 'Son : oui', soundOff: 'Son : non', quit: 'Quitter vers le menu',
      t0: 'Peindre', t1: 'Motif', t2: 'Sticker', t3: 'Lacets', t4: 'Modèle',
      h0: 'Touchez une zone pour la peindre', h1: 'Choisissez un motif, puis une zone', h2: 'Glissez un sticker sur la chaussure', h3: 'Choisissez un laçage', h4: 'Choisissez un modèle',
      tut1: "Prenez l'encre rose", tut2: 'Touchez une zone pour la peindre', tut3: 'Ajoutez maintenant le bleu', tut4: 'Ouvrez les stickers', tut5: "Glissez l'étoile sur le panneau latéral", tut6: 'Conforme à la commande ? Touchez Fini !',
      tutR: 'Chaque critère rempli donne du hype. Vite + belles couleurs = plus.',
      r_color: 'Utilisez cette encre quelque part', r_zone: 'Peignez {x} de cette encre', r_vibe: 'Style {x} : surtout ces encres', r_pat: 'Appliquez ce motif', r_stk: 'Ajoutez ce sticker',
      r_ban: 'Pas cette encre, nulle part', r_mood: 'Suivez le moodboard', r_lace: 'Utilisez ce laçage', r_sil: 'Faites-la sur ce modèle', r_keep: 'Remix : gardez les autres zones',
      z0: "l'empeigne", z1: 'le panneau latéral', z2: 'le bout', z3: 'le talon', z4: 'le col', z5: 'les lacets', z6: 'la semelle intermédiaire', z7: 'la semelle',
      v0: 'Rétro', v1: 'Nuit', v2: 'Plage', v3: 'Forêt', v4: 'Bonbon', v5: 'Mono',
      p0: 'Uni', p1: 'Dégradé', p2: 'Moucheté', p3: 'Rayures', p4: 'Damier', p5: 'Camo',
      s0: 'Étoile', s1: 'Éclair', s2: 'Vague', s3: 'Flamme', s4: 'Œil', s5: 'Bouille',
      l0: 'Classique', l1: 'Croisé', l2: 'Échelle', l3: 'Épais',
      k0: 'Runner', k1: 'Montante', k2: 'Trail', k3: 'Slip-on',
      hype: 'HYPE', harmony: 'Harmonie', speed: 'Vitesse', booth: 'Cabine', pin: 'Épingler', pinned: 'Épinglée !',
      remix: 'Remix', picky: 'Client exigeant', dayDone: 'Jour {n} terminé', shop: 'Boutique', nextDay: 'Ouvrir le jour {n}',
      soldOut: 'Vous avez tout. Légende.', broke: "Pas assez d'argent", locked: 'À débloquer en boutique',
      i_ink: "Pack d'encres", i_booth: 'Cabine de peinture', i_booth2: 'Cabine pro', i_window: 'Vitrine',
      d_ink: '2 nouvelles encres riso', d_pat: 'Nouveau motif', d_stk: 'Nouveau sticker', d_lace: 'Nouveau laçage', d_sil: 'Nouveau modèle',
      d_booth: '+5 de hype sur chaque paire', d_window: 'Clients exigeants, +40 % de paie',
      wall: "Mur de l'atelier", wallEmpty: 'Épinglez vos meilleures paires depuis le résultat.', back: 'Retour',
      tier: 'Palier {n} ! Commandes plus dures, meilleure paie.', rep: 'Rép', kicks: 'Paires', tipLook: "Touchez une icône de la commande pour l'expliquer",
      wallFull: 'Mur plein : la plus ancienne est retirée', earned: "Aujourd'hui", clientN: 'Client {n}/{m}', avg: 'Hype moyen',
      max3: 'Max 3 stickers. Glissez-en un dehors pour le retirer.'
    },
    de: {
      tag: 'Custom-Sneaker-Studio', play: 'Studio öffnen', cont: 'Weiter · Tag {n}', fresh: 'Neues Studio', sure: 'Nochmal tippen zum Neustart',
      day: 'Tag {n}', done: 'Fertig', next: 'Nächster Kunde', paused: 'Pause', resume: 'Weiter', soundOn: 'Ton: an', soundOff: 'Ton: aus', quit: 'Zum Menü',
      t0: 'Malen', t1: 'Muster', t2: 'Sticker', t3: 'Schnürung', t4: 'Modell',
      h0: 'Tippe auf eine Zone zum Malen', h1: 'Muster wählen, dann Zone antippen', h2: 'Ziehe einen Sticker auf den Schuh', h3: 'Wähle eine Schnürung', h4: 'Wähle ein Modell',
      tut1: 'Nimm die pinke Farbe', tut2: 'Tippe auf eine Zone zum Malen', tut3: 'Jetzt noch Blau dazu', tut4: 'Öffne die Sticker', tut5: 'Zieh den Stern aufs Seitenteil', tut6: 'Passt zur Bestellung? Tippe auf Fertig!',
      tutR: 'Jeder Haken bringt Hype. Schnell + gute Farben = mehr.',
      r_color: 'Nutze diese Farbe irgendwo', r_zone: 'Male {x} in dieser Farbe', r_vibe: '{x}-Stil: vor allem diese Farben', r_pat: 'Sprühe dieses Muster', r_stk: 'Klebe diesen Sticker auf',
      r_ban: 'Diese Farbe nirgends', r_mood: 'Triff das Moodboard', r_lace: 'Nutze diese Schnürung', r_sil: 'Mach es auf diesem Modell', r_keep: 'Remix: lass die anderen Zonen so',
      z0: 'das Obermaterial', z1: 'das Seitenteil', z2: 'die Zehenkappe', z3: 'die Ferse', z4: 'den Kragen', z5: 'die Schnürsenkel', z6: 'die Zwischensohle', z7: 'die Sohle',
      v0: 'Retro', v1: 'Nacht', v2: 'Strand', v3: 'Wald', v4: 'Candy', v5: 'Mono',
      p0: 'Uni', p1: 'Verlauf', p2: 'Sprenkel', p3: 'Streifen', p4: 'Karo', p5: 'Camo',
      s0: 'Stern', s1: 'Blitz', s2: 'Welle', s3: 'Flamme', s4: 'Auge', s5: 'Gesicht',
      l0: 'Klassisch', l1: 'Gekreuzt', l2: 'Leiter', l3: 'Dick',
      k0: 'Runner', k1: 'High-Top', k2: 'Trail', k3: 'Slip-on',
      hype: 'HYPE', harmony: 'Harmonie', speed: 'Tempo', booth: 'Kabine', pin: 'Pinnen', pinned: 'Gepinnt!',
      remix: 'Remix', picky: 'Wählerischer Kunde', dayDone: 'Tag {n} geschafft', shop: 'Shop', nextDay: 'Tag {n} öffnen',
      soldOut: 'Du hast alles. Legende.', broke: 'Nicht genug Geld', locked: 'Im Shop freischalten',
      i_ink: 'Farbpaket', i_booth: 'Sprühkabine', i_booth2: 'Profi-Kabine', i_window: 'Schaufenster',
      d_ink: '2 neue Riso-Farben', d_pat: 'Neues Muster', d_stk: 'Neuer Sticker', d_lace: 'Neue Schnürung', d_sil: 'Neues Modell',
      d_booth: '+5 Hype für jedes Paar', d_window: 'Wählerische Kunden, +40 % Lohn',
      wall: 'Studiowand', wallEmpty: 'Pinne deine besten Paare im Ergebnis.', back: 'Zurück',
      tier: 'Stufe {n}! Härtere Aufträge, mehr Geld.', rep: 'Ruf', kicks: 'Paare', tipLook: 'Tippe auf ein Auftragssymbol für Infos',
      wallFull: 'Wand voll: der älteste Pin ist weg', earned: 'Heute', clientN: 'Kunde {n}/{m}', avg: 'Ø Hype',
      max3: 'Max. 3 Sticker. Zieh einen weg, um ihn zu entfernen.'
    }
  };

  var lang = 'en';
  KL.setLang = function (tag) {
    var l = String(tag || 'en').toLowerCase().slice(0, 2);
    lang = D[l] ? l : 'en';
  };
  KL.lang = function () { return lang; };
  KL.t = function (key, n, m, x) {
    var s = (D[lang] && D[lang][key]) || D.en[key] || key;
    if (n !== undefined) s = s.replace('{n}', n);
    if (m !== undefined) s = s.replace('{m}', m);
    if (x !== undefined) s = s.replace('{x}', x);
    return s;
  };
  KL.DICT = D;
})();
