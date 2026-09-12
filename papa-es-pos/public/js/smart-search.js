(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PapaSearch = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // clean string and drop symbols
  function normalize(value) {
    var text = String(value == null ? '' : value).toLowerCase();
    if (text.normalize) text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return text.replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // split into individual words
  function tokenize(value) {
    var normalized = normalize(value);
    return normalized ? normalized.split(' ') : [];
  }

  // get first letter of each word
  function initials(value) {
    return tokenize(value).map(function (token) { return token.charAt(0); }).join('');
  }

  // keep first letter and strip vowels
  function skeleton(value) {
    return tokenize(value).map(function (token) {
      return token.charAt(0) + token.slice(1).replace(/[aeiou]/g, '');
    }).join(' ');
  }

  // calculate edit distance bounded by max
  function editDistance(a, b, max) {
    if (a === b) return 0;
    var ceiling = typeof max === 'number' ? max : Infinity;
    if (Math.abs(a.length - b.length) > ceiling) return ceiling + 1;

    var previous = [];
    var current = [];
    var i;
    var j;

    for (j = 0; j <= b.length; j += 1) previous[j] = j;

    for (i = 1; i <= a.length; i += 1) {
      current[0] = i;
      var rowBest = current[0];

      for (j = 1; j <= b.length; j += 1) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
        if (current[j] < rowBest) rowBest = current[j];
      }

      if (rowBest > ceiling) return ceiling + 1;
      previous = current.slice();
    }

    return previous[b.length];
  }

  // maximum allowed typos based on word length
  function tolerance(length) {
    if (length <= 3) return 0;
    if (length <= 6) return 1;
    return 2;
  }

  // check if letters appear in sequence
  function isSubsequence(query, text) {
    if (!query) return true;
    var index = 0;
    for (var i = 0; i < text.length && index < query.length; i += 1) {
      if (text.charAt(i) === query.charAt(index)) index += 1;
    }
    return index === query.length;
  }

  // score single query word against single text word
  function tokenScore(queryToken, textToken) {
    if (queryToken === textToken) return 1;
    if (textToken.indexOf(queryToken) === 0) return 0.9;
    if (textToken.indexOf(queryToken) > 0) return 0.7;

    var bones = textToken.charAt(0) + textToken.slice(1).replace(/[aeiou]/g, '');
    if (bones.indexOf(queryToken) === 0) return 0.68;
    if (isSubsequence(queryToken, textToken)) return 0.55;

    var limit = tolerance(Math.max(queryToken.length, textToken.length));
    if (limit > 0) {
      var distance = editDistance(queryToken, textToken, limit);
      if (distance <= limit) return Math.max(0.4, 0.65 - distance * 0.1);
    }

    return 0;
  }

  // calculate match score from 0 to 1
  function score(query, value) {
    var q = normalize(query);
    if (!q) return 1;

    var haystacks = (Array.isArray(value) ? value : [value])
      .map(normalize)
      .filter(function (text) { return text.length > 0; });
    if (!haystacks.length) return 0;

    var best = 0;

    for (var h = 0; h < haystacks.length; h += 1) {
      var text = haystacks[h];
      var weight = h === 0 ? 1 : 0.8;
      var candidate = 0;

      var compact = q.replace(/ /g, '');
      if (text === q) candidate = 1;
      else if (text.indexOf(q) === 0) candidate = 0.95;
      else if (text.indexOf(q) > 0) candidate = 0.85;
      else if (initials(text) === compact) candidate = 0.9;
      else if (initials(text).indexOf(compact) === 0) candidate = 0.8;
      else if (skeleton(text).replace(/ /g, '').indexOf(compact) === 0) candidate = 0.78;

      if (candidate === 0) {
        var queryTokens = q.split(' ');
        var textTokens = text.split(' ');
        var sum = 0;
        var matchedAll = true;

        for (var i = 0; i < queryTokens.length; i += 1) {
          var bestToken = 0;
          for (var j = 0; j < textTokens.length; j += 1) {
            var current = tokenScore(queryTokens[i], textTokens[j]);
            if (current > bestToken) bestToken = current;
          }
          if (bestToken === 0) { matchedAll = false; break; }
          sum += bestToken;
        }

        if (matchedAll) candidate = 0.45 + 0.3 * (sum / queryTokens.length);
      }

      if (candidate * weight > best) best = candidate * weight;
    }

    return best;
  }

  var MIN_SCORE = 0.45;

  // check if score meets minimum threshold
  function matches(query, value, minScore) {
    return score(query, value) >= (typeof minScore === 'number' ? minScore : MIN_SCORE);
  }

  // rank items by best score
  function rank(items, query, textOf, options) {
    var settings = options || {};
    var minScore = typeof settings.minScore === 'number' ? settings.minScore : MIN_SCORE;

    var scored = (items || []).map(function (item, index) {
      return { item: item, index: index, score: score(query, textOf(item)) };
    }).filter(function (entry) {
      return entry.score >= minScore;
    });

    scored.sort(function (a, b) {
      return b.score - a.score || a.index - b.index;
    });

    return typeof settings.limit === 'number' ? scored.slice(0, settings.limit) : scored;
  }

  // return filtered array of matching items
  function filter(items, query, textOf, options) {
    return rank(items, query, textOf, options).map(function (entry) { return entry.item; });
  }

  // filter dom elements based on search attribute
  function applyToElements(query, elements, options) {
    var settings = options || {};
    var list = Array.prototype.slice.call(elements || []);
    var textOf = settings.textOf || function (element) {
      return element.getAttribute('data-search') || element.textContent || '';
    };

    var keep = rank(list, query, textOf, { minScore: settings.minScore });
    var visible = {};
    keep.forEach(function (entry) { visible[entry.index] = true; });

    list.forEach(function (element, index) {
      var show = visible[index] === true;
      element.classList.toggle(settings.hiddenClass || 'hidden', !show);
      if (!settings.hiddenClass) element.style.display = show ? '' : 'none';
    });

    if (settings.reorder && keep.length && list[0] && list[0].parentNode) {
      var parent = list[0].parentNode;
      keep.forEach(function (entry) { parent.appendChild(entry.item); });
    }

    return keep.length;
  }

  return {
    MIN_SCORE: MIN_SCORE,
    normalize: normalize,
    tokenize: tokenize,
    initials: initials,
    skeleton: skeleton,
    editDistance: editDistance,
    isSubsequence: isSubsequence,
    tokenScore: tokenScore,
    score: score,
    matches: matches,
    rank: rank,
    filter: filter,
    applyToElements: applyToElements
  };
});