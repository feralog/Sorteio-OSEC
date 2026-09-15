/* ===========================================================
   Sorteio OSEC — motor da roleta
   Usado por todas as subpáginas: iniciarSorteio("slug-da-categoria")
   =========================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------------------------------------------------------
     Aleatoriedade (crypto, sem viés de módulo)
     --------------------------------------------------------- */
  function inteiroAleatorio(max) {
    if (max <= 0) return 0;
    var cr = window.crypto || window.msCrypto;
    if (cr && cr.getRandomValues) {
      var limite = Math.floor(0xFFFFFFFF / max) * max;
      var buf = new Uint32Array(1), v;
      do { cr.getRandomValues(buf); v = buf[0]; } while (v >= limite);
      return v % max;
    }
    return Math.floor(Math.random() * max);
  }

  function embaralhar(arr) {
    var r = arr.slice(), i, j, t;
    for (i = r.length - 1; i > 0; i--) {
      j = inteiroAleatorio(i + 1);
      t = r[i]; r[i] = r[j]; r[j] = t;
    }
    return r;
  }

  /* ---------------------------------------------------------
     Som (WebAudio — sem arquivos externos)
     --------------------------------------------------------- */
  var ac = null;
  var somLigado = (function () {
    try { return localStorage.getItem('sorteio-osec:som') !== '0'; } catch (e) { return true; }
  })();

  function contexto() {
    if (!ac) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (C) ac = new C();
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }

  function nota(freq, atraso, dur, vol, tipo) {
    var a = contexto(); if (!a) return;
    var t = a.currentTime + atraso;
    var osc = a.createOscillator(), g = a.createGain();
    osc.type = tipo || 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(a.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function clique() { if (somLigado) nota(1050 + inteiroAleatorio(160), 0, 0.045, 0.045, 'square'); }

  function fanfarra() {
    if (!somLigado) return;
    [[523.25, 0], [659.25, 0.10], [783.99, 0.20], [1046.5, 0.32]].forEach(function (n) {
      nota(n[0], n[1], 0.42, 0.16, 'triangle');
    });
  }

  /* ---------------------------------------------------------
     Persistência dos resultados
     --------------------------------------------------------- */
  function chave(slug) { return 'sorteio-osec:ganhadores:' + slug; }

  function lerGanhadores(slug) {
    try {
      var v = JSON.parse(localStorage.getItem(chave(slug)));
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function gravarGanhadores(slug, arr) {
    try { localStorage.setItem(chave(slug), JSON.stringify(arr)); } catch (e) { /* modo privado */ }
  }

  /* ---------------------------------------------------------
     Lista de nomes — dados.js traz a lista padrão e o navegador
     guarda a lista editada em lote na página da categoria
     --------------------------------------------------------- */
  function chaveNomes(slug) { return 'sorteio-osec:nomes:' + slug; }

  /* tira marcadores, espaços sobrando, linhas vazias e repetidos */
  function normalizarLista(itens) {
    var vistos = Object.create(null), saida = [];
    itens.forEach(function (item) {
      if (typeof item !== 'string') return;
      var n = item.replace(/^\s*(?:[-*\u2022]|\d+\s*[.)])\s*/, '').replace(/\s+/g, ' ').trim();
      if (!n) return;
      var k = n.toLowerCase();
      if (vistos[k]) return;
      vistos[k] = 1;
      saida.push(n);
    });
    return saida;
  }

  /* texto colado -> lista de nomes (um por linha; aceita ; e , como separador) */
  function listaDoTexto(txt) {
    var partes = String(txt).split(/[\r\n;]+/);
    var cheias = partes.filter(function (p) { return p.trim(); });
    if (cheias.length < 2) partes = String(txt).split(/[;,\r\n]+/);
    return normalizarLista(partes);
  }

  function lerNomesSalvos(slug) {
    try {
      var v = JSON.parse(localStorage.getItem(chaveNomes(slug)));
      if (!Array.isArray(v)) return null;
      var limpos = normalizarLista(v);
      return limpos.length ? limpos : null;
    } catch (e) { return null; }
  }

  function nomesDe(cat) { return lerNomesSalvos(cat.slug) || cat.nomes.slice(); }

  function listaEditada(slug) { return lerNomesSalvos(slug) !== null; }

  function gravarNomes(slug, arr) {
    try { localStorage.setItem(chaveNomes(slug), JSON.stringify(arr)); } catch (e) { /* modo privado */ }
  }

  function restaurarNomes(slug) {
    try { localStorage.removeItem(chaveNomes(slug)); } catch (e) {}
  }

  window.SorteioStore = {
    ler: lerGanhadores,
    nomes: nomesDe,
    editada: listaEditada,
    limparTudo: function () {
      (window.CATEGORIAS || []).forEach(function (c) {
        try { localStorage.removeItem(chave(c.slug)); } catch (e) {}
      });
    }
  };

  /* ---------------------------------------------------------
     Página de categoria
     --------------------------------------------------------- */
  window.iniciarSorteio = function (slug) {
    var cat = (window.CATEGORIAS || []).filter(function (c) { return c.slug === slug; })[0];
    if (!cat) { console.error('Categoria não encontrada:', slug); return; }

    document.documentElement.style.setProperty('--accent', cat.cor);

    var faixa    = $('#faixa');
    var roleta   = $('#roleta');
    var btn      = $('#sortear');
    var btnLimpa = $('#limpar');
    var btnSom   = $('#som');
    var caixaWin = $('#vencedor');
    var ulPart   = $('#participantes');
    var ulGanha  = $('#ganhadores');
    var contaP   = $('#conta-part');
    var contaG   = $('#conta-ganha');
    var chk      = $('#excluir');
    var aviso    = $('#aviso');

    var nomes = nomesDe(cat);
    var ganhadores = lerGanhadores(slug);
    var girando = false;

    /* ---- pool disponível ---- */
    function disponiveis() {
      if (!chk.checked) return nomes.slice();
      return nomes.filter(function (n) { return ganhadores.indexOf(n) === -1; });
    }

    /* ---- listas ---- */
    function renderListas() {
      var restantes = nomes.filter(function (n) { return ganhadores.indexOf(n) === -1; }).length;
      contaP.textContent = restantes + ' de ' + nomes.length;
      document.querySelectorAll('[data-conta-participantes]').forEach(function (el) {
        el.textContent = nomes.length;
      });
      avisoEditada.hidden = !listaEditada(slug);
      ulPart.innerHTML = '';
      if (!nomes.length) {
        var semNomes = document.createElement('li');
        semNomes.className = 'vazio';
        semNomes.textContent = 'Nenhum participante na lista. Use "Editar lista" para colar os nomes.';
        ulPart.appendChild(semNomes);
      }
      nomes.forEach(function (nome, i) {
        var saiu = ganhadores.indexOf(nome) !== -1;
        var li = document.createElement('li');
        if (saiu) li.className = 'ja-saiu';
        li.innerHTML = '<span class="pos">' + (saiu ? '★' : (i + 1)) + '</span>' +
                       '<span class="nome-txt"></span>';
        li.querySelector('.nome-txt').textContent = nome;
        ulPart.appendChild(li);
      });

      contaG.textContent = ganhadores.length;
      ulGanha.innerHTML = '';
      if (!ganhadores.length) {
        var vazio = document.createElement('li');
        vazio.className = 'vazio';
        vazio.textContent = 'Nenhum sorteio realizado ainda.';
        ulGanha.appendChild(vazio);
      } else {
        ganhadores.forEach(function (nome, i) {
          var fora = nomes.indexOf(nome) === -1;
          var li = document.createElement('li');
          li.className = 'ganhador-item' + (fora ? ' fora' : '');
          li.innerHTML = '<span class="pos">' + (i + 1) + '</span><span class="nome-txt"></span>' +
                         (fora ? '<span class="tag-fora">fora da lista</span>' : '');
          li.querySelector('.nome-txt').textContent = nome;
          ulGanha.appendChild(li);
        });
      }
      btnLimpa.disabled = !ganhadores.length;
      atualizarBotao();
    }

    function atualizarBotao() {
      var n = disponiveis().length;
      btn.disabled = girando || n === 0;
      btnEditar.disabled = girando;
      if (!nomes.length) {
        btn.textContent = 'Sem participantes';
        aviso.textContent = 'Use "Editar lista" para colar os nomes de quem vai concorrer.';
      } else if (n === 0) {
        btn.textContent = 'Todos já foram sorteados';
        aviso.textContent = 'Desmarque "não repetir" ou limpe os resultados para sortear de novo.';
      } else {
        btn.textContent = ganhadores.length ? 'Sortear de novo' : 'Sortear';
        aviso.innerHTML = 'Atalho: <kbd>Espaço</kbd> — ' + n + (n === 1 ? ' nome no sorteio' : ' nomes no sorteio');
      }
    }

    /* ---- montagem da faixa ---- */
    var TOTAL = 70;

    function montarFaixa(ganhador, pool) {
      var itens = [];
      while (itens.length < TOTAL) itens = itens.concat(embaralhar(pool));
      itens.length = TOTAL;
      var idx = TOTAL - 2;               // deixa 1 item abaixo p/ preencher a 3ª linha
      itens[idx] = ganhador;

      var frag = document.createDocumentFragment();
      itens.forEach(function (n) {
        var d = document.createElement('div');
        d.className = 'item';
        d.textContent = n;
        frag.appendChild(d);
      });
      faixa.innerHTML = '';
      faixa.appendChild(frag);
      faixa.style.transform = 'translate3d(0,0,0)';
      return idx;
    }

    function alturaItem() {
      var primeiro = faixa.firstElementChild;
      return primeiro ? primeiro.getBoundingClientRect().height : 112;
    }

    /* ---- perfil de velocidade: acelera, embala, desacelera até parar ---- */
    var ACEL = 0.14;
    var VMAX = 1 / (ACEL / 2 + (1 - ACEL) / 4);

    function perfil(t) {
      if (t < ACEL) return VMAX * t * t / (2 * ACEL);
      var u = (t - ACEL) / (1 - ACEL);
      return VMAX * ACEL / 2 + VMAX * (1 - ACEL) / 4 * (1 - Math.pow(1 - u, 4));
    }

    var centroAtual = -1, ultimoClique = 0;

    function marcarCentro(i) {
      if (i === centroAtual) return;
      var antes = faixa.children[centroAtual];
      if (antes) antes.classList.remove('centro');
      var agora = faixa.children[i];
      if (agora) agora.classList.add('centro');
      centroAtual = i;
      var t = performance.now();
      if (t - ultimoClique > 42) { ultimoClique = t; clique(); }
    }

    function girar(idx, fim) {
      var h = alturaItem();
      var alvo = (idx - 1) * h;          // -1 porque o item fica na linha do meio
      var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var dur = reduzir ? 900 : 5200 + inteiroAleatorio(900);
      var t0 = performance.now();
      centroAtual = -1;

      (function quadro(agora) {
        var t = Math.min(1, (agora - t0) / dur);
        var y = alvo * perfil(t);
        faixa.style.transform = 'translate3d(0,' + (-y) + 'px,0)';
        marcarCentro(Math.round(y / h) + 1);
        if (t < 1) requestAnimationFrame(quadro);
        else {
          faixa.style.transform = 'translate3d(0,' + (-alvo) + 'px,0)';
          marcarCentro(idx);
          fim();
        }
      })(t0);
    }

    /* ---- vencedor ---- */
    function mostrarVencedor(nome) {
      caixaWin.hidden = false;
      caixaWin.innerHTML =
        '<div class="rotulo">' + (ganhadores.length) + 'º sorteado · ' + cat.nome + '</div>' +
        '<p class="nome"></p>' +
        '<p class="premio">Sorteado entre ' + nomes.length + ' participantes · ' +
        new Date().toLocaleString('pt-BR') + '</p>';
      caixaWin.querySelector('.nome').textContent = nome;
    }

    function esconderVencedor() { caixaWin.hidden = true; caixaWin.innerHTML = ''; }

    /* ---- confete ---- */
    function confete() {
      var cv = $('#confete'); if (!cv || !cv.getContext) return;
      var ctx = cv.getContext('2d');
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = cv.clientWidth, h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var cores = [cat.cor, '#ffffff', '#ffd166', '#8be9c0', '#ff8fa3'];
      var ps = [], i;
      for (i = 0; i < 150; i++) {
        ps.push({
          x: Math.random() * w, y: -20 - Math.random() * h * 0.5,
          vx: (Math.random() - 0.5) * 2.6, vy: 1.8 + Math.random() * 3.4,
          s: 5 + Math.random() * 7, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
          c: cores[(Math.random() * cores.length) | 0]
        });
      }
      var t0 = performance.now();
      (function quadro(agora) {
        var dt = Math.min(2.5, (agora - t0) / 16.67); t0 = agora;
        ctx.clearRect(0, 0, w, h);
        var vivos = 0;
        ps.forEach(function (p) {
          p.vy += 0.045 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
          if (p.y > h + 30) return;
          vivos++;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
          ctx.globalAlpha = 0.95; ctx.fillStyle = p.c;
          ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
          ctx.restore();
        });
        if (vivos) requestAnimationFrame(quadro); else ctx.clearRect(0, 0, w, h);
      })(t0);
    }

    /* ---- ação principal ---- */
    function sortear() {
      if (girando) return;
      var pool = disponiveis();
      if (!pool.length) return;

      girando = true;
      if (editando) fecharEditor();
      btn.disabled = true; btnLimpa.disabled = true; chk.disabled = true;
      btnEditar.disabled = true;
      esconderVencedor();
      contexto();                                   // destrava o áudio no clique do usuário

      var ganhador = pool[inteiroAleatorio(pool.length)];
      var idx = montarFaixa(ganhador, pool);

      girar(idx, function () {
        ganhadores.push(ganhador);
        gravarGanhadores(slug, ganhadores);
        mostrarVencedor(ganhador);
        fanfarra();
        confete();
        girando = false;
        chk.disabled = false;
        renderListas();
        caixaWin.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    /* ---------------------------------------------------------
       Edição em lote: a caixa vira um campo de texto com um nome
       por linha — dá para selecionar tudo e colar a lista nova
       --------------------------------------------------------- */
    var painelPart = ulPart.parentNode;

    var btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.className = 'btn fantasma mini';
    btnEditar.textContent = 'Editar lista';
    (painelPart.querySelector('h2') || painelPart).appendChild(btnEditar);

    var avisoEditada = document.createElement('p');
    avisoEditada.className = 'editor-nota';
    avisoEditada.hidden = true;
    avisoEditada.innerHTML = 'Lista editada neste navegador. ' +
      '<button type="button" class="link-restaurar">Restaurar original</button>';
    painelPart.insertBefore(avisoEditada, ulPart);

    var editor = document.createElement('div');
    editor.className = 'editor-nomes';
    editor.hidden = true;
    editor.innerHTML =
      '<textarea spellcheck="false" aria-label="Participantes, um nome por linha"></textarea>' +
      '<p class="editor-dica">Um nome por linha. Para trocar todo mundo: ' +
      '<kbd>Ctrl</kbd>+<kbd>A</kbd> e cole a lista nova. ' +
      'Linhas vazias e nomes repetidos são descartados.</p>' +
      '<div class="editor-acoes">' +
        '<button type="button" class="btn fantasma mini principal" data-acao="salvar">Salvar lista</button>' +
        '<button type="button" class="btn fantasma mini" data-acao="cancelar">Cancelar</button>' +
        '<button type="button" class="btn fantasma mini" data-acao="restaurar">Restaurar original</button>' +
      '</div>';
    painelPart.appendChild(editor);

    var area = editor.querySelector('textarea');
    var btnRestaurar = editor.querySelector('[data-acao="restaurar"]');
    var editando = false;

    function abrirEditor() {
      editando = true;
      area.value = nomes.join('\n');
      ulPart.hidden = true;
      editor.hidden = false;
      btnEditar.textContent = 'Fechar edição';
      btnRestaurar.hidden = !listaEditada(slug);
      area.focus();
      area.select();                 // já vem tudo selecionado: é só colar por cima
      area.scrollTop = 0;
    }

    function fecharEditor() {
      editando = false;
      editor.hidden = true;
      ulPart.hidden = false;
      btnEditar.textContent = 'Editar lista';
    }

    function aplicarNomes(novos) {
      nomes = novos;
      esconderVencedor();
      renderListas();
      faixaInicial();
    }

    function salvarEditor() {
      if (girando) return;
      var novos = listaDoTexto(area.value);
      if (!novos.length) {
        alert('A lista ficou vazia — escreva ou cole ao menos um nome.');
        area.focus();
        return;
      }
      gravarNomes(slug, novos);
      aplicarNomes(novos);
      fecharEditor();
    }

    function voltarAoOriginal() {
      if (girando) return;
      if (!confirm('Voltar para a lista original de "' + cat.nome + '"?')) return;
      restaurarNomes(slug);
      aplicarNomes(cat.nomes.slice());
      if (editando) {
        area.value = nomes.join('\n');
        btnRestaurar.hidden = true;
        area.focus();
        area.select();
        area.scrollTop = 0;
      }
    }

    btnEditar.addEventListener('click', function () {
      if (editando) fecharEditor(); else abrirEditor();
    });

    editor.addEventListener('click', function (e) {
      var acao = e.target.getAttribute && e.target.getAttribute('data-acao');
      if (acao === 'salvar') salvarEditor();
      else if (acao === 'cancelar') fecharEditor();
      else if (acao === 'restaurar') voltarAoOriginal();
    });

    avisoEditada.querySelector('.link-restaurar').addEventListener('click', voltarAoOriginal);

    area.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); fecharEditor(); btnEditar.focus(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.code === 'Enter')) {
        e.preventDefault(); salvarEditor();
      }
    });

    /* ---- eventos ---- */
    btn.addEventListener('click', sortear);

    btnLimpa.addEventListener('click', function () {
      if (!ganhadores.length) return;
      if (!confirm('Apagar os ' + ganhadores.length + ' resultado(s) de "' + cat.nome + '"?')) return;
      ganhadores = [];
      gravarGanhadores(slug, ganhadores);
      esconderVencedor();
      renderListas();
      faixaInicial();
    });

    chk.addEventListener('change', atualizarBotao);

    function pintarSom() { btnSom.textContent = somLigado ? '🔊 Som ligado' : '🔇 Som desligado'; }
    btnSom.addEventListener('click', function () {
      somLigado = !somLigado;
      try { localStorage.setItem('sorteio-osec:som', somLigado ? '1' : '0'); } catch (e) {}
      pintarSom();
      if (somLigado) { contexto(); clique(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.code !== 'Space' && e.code !== 'Enter' && e.key !== ' ') return;
      var alvo = e.target.tagName;
      if (alvo === 'BUTTON' || alvo === 'INPUT' || alvo === 'A' || alvo === 'TEXTAREA') return;
      e.preventDefault();
      sortear();
    });

    window.addEventListener('resize', function () {
      if (!girando && faixa.firstElementChild) faixaInicial();
    });

    /* ---- estado inicial ---- */
    function faixaInicial() {
      var pool = disponiveis();
      if (!pool.length) pool = nomes;
      if (!pool.length) pool = ['—'];
      var base = embaralhar(pool);
      while (base.length < 3) base = base.concat(base);
      var frag = document.createDocumentFragment();
      base.slice(0, 3).forEach(function (n, i) {
        var d = document.createElement('div');
        d.className = 'item' + (i === 1 ? ' centro' : '');
        d.textContent = n;
        frag.appendChild(d);
      });
      faixa.innerHTML = '';
      faixa.appendChild(frag);
      faixa.style.transform = 'translate3d(0,0,0)';
      centroAtual = 1;
    }

    pintarSom();
    renderListas();
    faixaInicial();
    roleta.setAttribute('aria-label', 'Roleta de sorteio de ' + cat.nome);
  };

  /* ---------------------------------------------------------
     Página inicial — status de cada categoria
     --------------------------------------------------------- */
  function preencher(seletor, valor) {
    document.querySelectorAll(seletor).forEach(function (el) { el.textContent = valor; });
  }

  window.montarHome = function () {
    var grade = $('#cartoes');
    if (!grade) return;
    grade.innerHTML = '';

    var pessoas = Object.create(null), inscricoes = 0;
    (window.CATEGORIAS || []).forEach(function (c) {
      nomesDe(c).forEach(function (n) { pessoas[n.toLowerCase()] = 1; inscricoes++; });
    });
    preencher('[data-total-categorias]', (window.CATEGORIAS || []).length);
    preencher('[data-total-pessoas]', Object.keys(pessoas).length);
    preencher('[data-total-inscricoes]', inscricoes);

    (window.CATEGORIAS || []).forEach(function (c) {
      var g = lerGanhadores(c.slug);
      var a = document.createElement('a');
      a.className = 'cartao';
      a.href = c.slug + '.html';
      a.style.setProperty('--accent', c.cor);
      a.innerHTML =
        '<span class="ico">' + c.icone + '</span>' +
        '<h3></h3>' +
        '<p class="meta">' + nomesDe(c).length + ' participantes' +
        (c.premios.length ? ' · ' + c.premios.length + (c.premios.length === 1 ? ' prêmio' : ' prêmios') : '') +
        '</p>' +
        '<span class="selo' + (g.length ? '' : ' neutro') + '">' +
          '<span class="ponto"></span>' +
          (g.length ? g.length + (g.length === 1 ? ' sorteado' : ' sorteados') : 'Aguardando sorteio') +
        '</span>';
      a.querySelector('h3').textContent = c.nome;
      grade.appendChild(a);
    });

    var limpar = $('#limpar-tudo');
    if (limpar) {
      limpar.addEventListener('click', function () {
        if (!confirm('Apagar os resultados de TODAS as categorias?')) return;
        window.SorteioStore.limparTudo();
        window.montarHome();
      });
    }
  };
})();
