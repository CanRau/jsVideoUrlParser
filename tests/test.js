(function(){
'use strict';
/*jshint unused:false */
function cloneObject(obj) {
  /*jshint unused:true */
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  var temp = obj.constructor(); // give temp the original obj's constructor
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      temp[key] = cloneObject(obj[key]);
    }
  }

  return temp;
}

/*jshint unused:false */
function getQueryParams(qs) {
  /*jshint unused:true */
  if (typeof qs !== 'string') {
    return {};
  }
  qs = qs.split('+').join(' ');

  var params = {};
  var match = qs.match(
    /*jshint ignore:start */
    /(?:[\?](?:[^=]+)=(?:[^&#]*)(?:[&](?:[^=]+)=(?:[^&#]*))*(?:[#].*)?)|(?:[#].*)/
    /*jshint ignore:end */
  );
  var split;

  if (match === null) {
    return {};
  }

  split = match[0].substr(1).split(/[&#=]/);

  for (var i = 0; i < split.length; i += 2) {
    params[decodeURIComponent(split[i])] =
      decodeURIComponent(split[i + 1] || '');
  }

  return params;
}

/*jshint unused:false */
function combineParams(op) {
  /*jshint unused:true */
  if (typeof op !== 'object') {
    return '';
  }
  op.params = op.params || {};
  var combined = '',
    i = 0,
    keys = Object.keys(op.params);

  if (keys.length === 0) {
    return '';
  }

  //always have parameters in the same order
  keys.sort();

  if (!op.hasParams) {
    combined += '?' + keys[0] + '=' + op.params[keys[0]];
    i += 1;
  }

  for (; i < keys.length; i += 1) {
    combined += '&' + keys[i] + '=' + op.params[keys[i]];
  }
  return combined;
}

//parses strings like 1h30m20s to seconds
/*jshint unused:false */
function getTime(timeString) {
  /*jshint unused:true */
  var totalSeconds = 0;
  var timeValues = {
    's': 1,
    'm': 1 * 60,
    'h': 1 * 60 * 60,
    'd': 1 * 60 * 60 * 24,
    'w': 1 * 60 * 60 * 24 * 7
  };
  var timePairs;
  //is the format 1h30m20s etc
  if (!timeString.match(/^(\d+[smhdw]?)+$/)) {
    return 0;
  }
  //expand to "1 h 30 m 20 s" and split
  timeString = timeString.replace(/([smhdw])/g, ' $1 ').trim();
  timePairs = timeString.split(' ');

  for (var i = 0; i < timePairs.length; i += 2) {
    totalSeconds += parseInt(timePairs[i], 10) *
      timeValues[timePairs[i + 1] || 's'];
  }
  return totalSeconds;
}

function UrlParser() {
  this.plugins = {};
}

UrlParser.prototype.parseProvider = function (url) {
  var match = url.match(
    /(?:(?:https?:)?\/\/)?(?:[^\.]+\.)?(\w+)\./i
  );
  return match ? match[1] : undefined;
};

UrlParser.prototype.removeEmptyParameters = function (result) {
  if (result.params && Object.keys(result.params).length === 0) {
    delete result.params;
  }
  return result;
};

UrlParser.prototype.parse = function (url) {
  var _this = this;
  var provider = _this.parseProvider(url);
  var result;
  var plugin = _this.plugins[provider];
  if (!provider || !plugin || !plugin.parse) {
    return undefined;
  }
  result = plugin.parse.apply(
    plugin, [url, getQueryParams(url)]
  );
  if (result) {
    result = _this.removeEmptyParameters(result);
    result.provider = plugin.provider;
  }
  return result;
};

UrlParser.prototype.bind = function (plugin) {
  this.plugins[plugin.provider] = plugin;
  if (plugin.alternatives) {
    for (var i = 0; i < plugin.alternatives.length; i += 1) {
      this.plugins[plugin.alternatives[i]] = plugin;
    }
  }
};

UrlParser.prototype.create = function (op) {
  var vi = op.videoInfo;
  var params = op.params;
  var plugin = this.plugins[vi.provider];

  params = (params === 'internal') ? vi.params : params || {};

  if (plugin) {
    op.format = op.format || plugin.defaultFormat;
    if (plugin.formats.hasOwnProperty(op.format)) {
      return plugin.formats[op.format].apply(plugin, [vi, cloneObject(params)]);
    }
  }
  return undefined;
};
var urlParser = new UrlParser();

/*jshint unused:false */
function assertUrlTest(assert, tests) {
  /*jshint unused:true */
  tests.forEach(function (test) {
    test.urls.forEach(function (url) {
      assert.deepEqual(window.urlParser.parse(url), test.videoInfo, url);
    });
    for (var format in test.formats) {
      if (test.formats.hasOwnProperty(format)) {
        assert.equal(window.urlParser.create({
          videoInfo: test.videoInfo,
          format: format,
          params: test.videoInfo.params
        }), test.formats[format], JSON.stringify(test.videoInfo));
      }
    }
  });
}

QUnit.test('urlParser Tests', function (assert) {
  var parser = new UrlParser();

  function Plugin() {
    this.provider = 'foo';
    this.alternatives = ['bar'];
    this.defaultFormat = 'long';
    this.formats = {
      long: this.createLongUrl
    };
  }

  Plugin.prototype.parse = function (url) {
    return {
      url: url
    };
  };

  Plugin.prototype.createLongUrl = function (vi, params) {
    return {
      videoInfo: vi,
      params: params
    };
  };
  parser.bind(new Plugin());

  assert.notStrictEqual(parser.plugins.foo, undefined, 'Binding provider');
  assert.notStrictEqual(parser.plugins.bar, undefined,
    'Binding alternative');

  assert.strictEqual(parser.parse('abc.def'), undefined, 'Undefined parse');
  assert.strictEqual(parser.parse('http://bar.def').provider, 'foo',
    'Alternative parse');
  assert.strictEqual(parser.parse('https://abc.foo.def/ghi').provider,
    'foo', 'Parse');
  assert.strictEqual(parser.parse('//abc.foo.def/ghi').provider, 'foo',
    'Parse');

  var createObj1 = {
      videoInfo: {
        provider: 'foo'
      },
      format: 'long'
    },
    createObj2 = {
      videoInfo: {
        provider: 'foo'
      },
      format: 'abc'
    },
    createObj3 = {
      videoInfo: {
        provider: 'abc'
      }
    },
    createObj4 = {
      videoInfo: {
        provider: 'foo',
        params: {
          foo: 'bar'
        }
      },
      params: 'internal'
    };
  assert.deepEqual(parser.create(createObj1).videoInfo, createObj1.videoInfo,
    'Create');
  assert.strictEqual(parser.create(createObj2), undefined,
    'Create not existing format');
  assert.strictEqual(parser.create(createObj3), undefined,
    'Create not existing provider');
  assert.deepEqual(parser.create(createObj4).params,
    createObj4.videoInfo.params, 'Create with internal params');

  function Plugin2() {
    this.provider = 'abc';
    this.formats = {};
  }
  parser.bind(new Plugin2());

  assert.strictEqual(parser.parse('http://abc.com'), undefined, 'No .parse');
  assert.strictEqual(parser.create(createObj3), undefined, 'No .create');

  for (var plugin in window.urlParser.plugins) {
    if (window.urlParser.plugins.hasOwnProperty(plugin)) {
      assert.notStrictEqual(window.urlParser.plugins[plugin].defaultFormat,
        undefined, 'Defaultformat not undefined ' + plugin);
    }
  }
});

QUnit.test('TimeString Parser', function (assert) {
  var s = 1,
    m = 60 * s,
    h = 60 * m,
    d = 24 * h,
    w = 7 * d,
    testPairs = {
      '1w': w,
      '1d': d,
      '1h': h,
      '1m': m,
      '1s': s,
      '1': s,
      '1w1d1h1m1s': w + d + h + m + s,
      '30w1m': 30 * w + m,
      '100': 100 * s,
      '4m30s': 4 * m + 30 * s,
      '04m30': 4 * m + 30 * s,
      '04m30s': 4 * m + 30 * s,
      '1h30m25s': h + 30 * m + 25 * s,
      '1h30m25': h + 30 * m + 25 * s,
      '1h30m25s25s': h + 30 * m + 25 * s + 25 * s,
      '1h30m25s25': h + 30 * m + 25 * s + 25 * s,
      '1h30m25s25s1h1w': h + 30 * m + 25 * s + 25 * s + h + w
    };

  for (var timeString in testPairs) {
    if (testPairs.hasOwnProperty(timeString)) {
      assert.equal(getTime(timeString), testPairs[timeString],
        timeString + ' === ' + testPairs[timeString]);
    }
  }
});

QUnit.test('GetQueryParams Tests', function (assert) {
  assert.deepEqual(getQueryParams(undefined), {}, 'Undefined argument');
  assert.deepEqual(getQueryParams([]), {}, 'Not a string argument');
  assert.deepEqual(getQueryParams('http://foo.bar/test'), {}, 'No params');
  assert.deepEqual(getQueryParams('http://foo.bar/test?foo=bar'), {
    foo: 'bar'
  }, '?foo=bar');
  assert.deepEqual(getQueryParams('http://foo.bar/test?foo=bar&'), {
    foo: 'bar'
  }, '?foo=bar&');
  assert.deepEqual(getQueryParams('http://foo.bar/test#foo=bar'), {
    foo: 'bar'
  }, '#foo=bar');
  assert.deepEqual(getQueryParams('http://foo.bar/test#foo'), {
    foo: ''
  }, '#foo');
  assert.deepEqual(getQueryParams('http://foo.bar/test?foo=bar&faz=baz'), {
    foo: 'bar',
    faz: 'baz'
  }, '?foo=bar&faz=baz');
  assert.deepEqual(
    getQueryParams('http://foo.bar/test?foo=bar&faz=baz#fiz=biz'), {
      foo: 'bar',
      faz: 'baz',
      fiz: 'biz'
    }, '?foo=bar&faz=baz#fiz=biz');
  assert.deepEqual(getQueryParams('http://foo.bar/test?foo=bar&faz=baz#fiz'), {
    foo: 'bar',
    faz: 'baz',
    fiz: ''
  }, '?foo=bar&faz=baz#fiz');
});

QUnit.test('CombineParams Tests', function (assert) {
  assert.equal(combineParams(undefined), '', 'Undefined argument');
  assert.equal(combineParams({}), '', 'No params object');

  assert.equal(combineParams({
    params: {
      foo: 'bar'
    }
  }), '?foo=bar', '{foo:\'bar\'}');
  assert.equal(combineParams({
    params: {
      foo: 'bar',
      faz: 'baz'
    }
  }), '?faz=baz&foo=bar', '{foo:\'bar\',faz:\'baz\'}');
  assert.equal(combineParams({
      params: {
        foo: 'bar',
        faz: 'baz',
        fiz: 'biz'
      }
    }), '?faz=baz&fiz=biz&foo=bar',
    '{foo: \'bar\',faz: \'baz\',fiz: \'biz\'}');

  assert.equal(combineParams({
    hasParams: true,
    params: {
      foo: 'bar'
    }
  }), '&foo=bar', '{foo:\'bar\'}');
  assert.equal(combineParams({
    hasParams: true,
    params: {
      foo: 'bar',
      faz: 'baz'
    }
  }), '&faz=baz&foo=bar', '{foo:\'bar\',faz:\'baz\'}');
  assert.equal(combineParams({
      hasParams: true,
      params: {
        foo: 'bar',
        faz: 'baz',
        fiz: 'biz'
      }
    }), '&faz=baz&fiz=biz&foo=bar',
    '{foo: \'bar\',faz: \'baz\',fiz: \'biz\'}');
});

QUnit.test('CanalPlus Urls', function (assert) {
  var vi = {
    provider: 'canalplus',
    id: '1365175',
    mediaType: 'video'
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      embed: 'http://player.canalplus.fr/embed/?vid=1365175'
    },
    urls: [
      'http://player.canalplus.fr/embed/?vid=1365175',
      'http://www.canalplus.fr/humour/pid1784-les-guignols.html?vid=1365175'
    ]
  }];
  assertUrlTest(assert, tests);
});

QUnit.test('Coub Urls', function (assert) {
  var vi = {
    'provider': 'coub',
    'id': 'by7sm',
    'mediaType': 'video'
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      embed: '//coub.com/embed/by7sm',
      long: 'https://coub.com/view/by7sm',
    },
    urls: [
      '//coub.com/embed/by7sm',
      'https://coub.com/view/by7sm'
    ]
  }];

  assertUrlTest(assert, tests);
});

QUnit.test('Dailymotion Urls', function (assert) {
  var vi = {
    provider: 'dailymotion',
    id: 'x1e2b95',
    mediaType: 'video'
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://dailymotion.com/video/x1e2b95',
      short: 'https://dai.ly/x1e2b95',
      embed: '//www.dailymotion.com/embed/video/x1e2b95'
    },
    urls: [
      'http://www.dailymotion.com/video/x1e2b95\
      _bruce-lee-nin-kayip-kedisi_animals',
      'http://www.dailymotion.com/video/x1e2b95',
      'http://dai.ly/x1e2b95',
      'http://www.dailymotion.com/embed/video/x1e2b95'
    ]
  }, {
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://dailymotion.com/video/x1e2b95?start=10',
      embed: '//www.dailymotion.com/embed/video/x1e2b95?start=10'
    },
    urls: ['http://www.dailymotion.com/video/x1e2b95?start=10',
      'http://www.dailymotion.com/video/x1e2b95\
      _bruce-lee-nin-kayip-kedisi_animals?start=10',
      'http://www.dailymotion.com/embed/video/x1e2b95?start=10'
    ]
  }];
  tests[1].videoInfo.params = {
    start: 10
  };

  assertUrlTest(assert, tests);
});

QUnit.test('Template Urls', function (assert) {
  //Parse urls to test against the videoInfo object
  //Create urls with the videoInfo objects to test against the format urls
  var vi = {
    provider: 'facebook',
    id: '1992429287701449',
    mediaType: 'video'
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://www.facebook.com/UNILADTech/videos/1992429287701449/',
      short: 'https://fb.com/1992429287701449'
    },
    urls: [
      'https://www.facebook.com/UNILADTech/videos/1992429287701449/?hc_ref=ARRjPLJXkpLJPs-vl8ScpNmOfzzTm4MEjJ59in37_HlpVRYxEqSvm_r-qYV_JjVTMeE',
      'https://www.facebook.com/UNILADTech/videos/1992429287701449/',
      'https://fb.com/1992429287701449'
    ]
  }];

  assertUrlTest(assert, tests);
});


var tw1 = 'https://clips.twitch.tv/';
QUnit.test('Twitch Stream Urls', function (assert) {
  var vi = {
    provider: 'twitch',
    channel: 'rains8',
    mediaType: 'stream'
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://twitch.tv/rains8',
      embed: 'https://player.twitch.tv/?channel=rains8'
    },
    urls: ['http://www.twitch.tv/rains8',
      'http://www.twitch.tv/widgets/live_embed_player.swf\
      ?channel=rains8',
      'http://twitch.tv/rains8/chat',
      '//www.twitch.tv/rains8/embed'
    ]
  }];
  assertUrlTest(assert, tests);
});

QUnit.test('Twitch Video Urls', function (assert) {
  var vi = {
    provider: 'twitch',
    id: 'v75292411',
    mediaType: 'video'
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://twitch.tv/videos/75292411',
      embed: 'https://player.twitch.tv/?video=v75292411'
    },
    urls: ['http://www.twitch.tv/videos/75292411']
  }, {
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://twitch.tv/videos/75292411?t=90s',
      embed: 'https://player.twitch.tv/?t=90s&video=v75292411'
    },
    urls: ['https://www.twitch.tv/videos/75292411?t=1m30s']
  }];
  tests[1].videoInfo.params = {
    start: 90
  };
  assertUrlTest(assert, tests);
});

QUnit.test('Twitch Clip Urls', function (assert) {
  var vi = {
    provider: 'twitch',
    id: 'SuspiciousImpartialLarkItsBoshyTime',
    mediaType: 'clip'
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      long: tw1 + 'SuspiciousImpartialLarkItsBoshyTime',
      embed: tw1 + 'embed?clip=SuspiciousImpartialLarkItsBoshyTime'
    },
    urls: [
      tw1 + 'SuspiciousImpartialLarkItsBoshyTime',
      tw1 + 'embed?clip=SuspiciousImpartialLarkItsBoshyTime'
    ]
  }];
  assertUrlTest(assert, tests);
});

QUnit.test('Vimeo Urls', function (assert) {
  var vi = {
    'provider': 'vimeo',
    'id': '97276391',
    'mediaType': 'video'
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://vimeo.com/97276391',
      embed: '//player.vimeo.com/video/97276391'
    },
    urls: ['https://vimeo.com/97276391',
      'https://vimeo.com/channels/staffpicks/97276391',
      '//player.vimeo.com/video/97276391'
    ]
  }, {
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://vimeo.com/96186586',
      embed: '//player.vimeo.com/video/96186586'
    },
    urls: ['https://vimeo.com/album/2903155/video/96186586',
      '//player.vimeo.com/video/96186586'
    ]
  }, {
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://vimeo.com/97688625',
      embed: '//player.vimeo.com/video/97688625'
    },
    urls: ['https://vimeo.com/groups/shortfilms/videos/97688625',
      '//player.vimeo.com/video/97688625',
      'https://vimeo.com/groups/1minute/videos/97688625'
    ]
  }, {
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://vimeo.com/24069938',
      embed: '//player.vimeo.com/video/24069938'
    },
    urls: ['http://vimeopro.com/staff/frame/video/24069938',
      '//player.vimeo.com/video/24069938'
    ]
  }, {
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://vimeo.com/36881035#t=208',
      embed: '//player.vimeo.com/video/36881035#t=208'
    },
    urls: ['https://vimeo.com/36881035#t=3m28s',
      '//player.vimeo.com/video/36881035#t=3m28s'
    ]
  }];

  tests[1].videoInfo.id = '96186586';
  tests[2].videoInfo.id = '97688625';
  tests[3].videoInfo.id = '24069938';
  tests[4].videoInfo.id = '36881035';
  tests[4].videoInfo.params = {
    start: 208
  };
  assertUrlTest(assert, tests);
});

var yt1 = 'https://youtube.com';
var yt2 = 'http://www.youtube.com';
var yt3 = 'https://www.youtube.com';
var yt4 = '//youtube.com/embed';
var yt5 = 'https://img.youtube.com';
QUnit.test('Regular YouTube Urls', function (assert) {
  var vi = {
    provider: 'youtube',
    id: 'HRb7B9fPhfA',
    mediaType: 'video',
    params: {
      start: 30
    }
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      long: yt1 + '/watch?v=HRb7B9fPhfA#t=30',
      embed: yt4 + '/HRb7B9fPhfA?start=30',
      short: 'https://youtu.be/HRb7B9fPhfA#t=30'
    },
    urls: [yt2 + '/watch?v=HRb7B9fPhfA#t=30s',
      yt2 + '/watch?v=HRb7B9fPhfA&t=30s',
      'https://m.youtube.com/details?v=HRb7B9fPhfA#t=30s',
      'http://youtu.be/HRb7B9fPhfA?t=30s',
      'http://youtu.be/HRb7B9fPhfA#t=30s',
      yt4 + '/HRb7B9fPhfA?start=30',
    ]
  }, {
    videoInfo: cloneObject(vi),
    formats: {
      long: yt1 + '/watch?v=HRb7B9fPhfA',
      embed: yt4 + '/HRb7B9fPhfA',
      short: 'https://youtu.be/HRb7B9fPhfA',
      shortImage: 'https://i.ytimg.com/vi/HRb7B9fPhfA/hqdefault.jpg',
      longImage: yt5 + '/vi/HRb7B9fPhfA/hqdefault.jpg'
    },
    urls: [yt2 + '/watch?v=HRb7B9fPhfA',
      'http://youtu.be/HRb7B9fPhfA',
      'https://m.youtube.com/details?v=HRb7B9fPhfA'
    ]
  }, {
    videoInfo: cloneObject(vi),
    formats: {
      embed: yt4 + '/HRb7B9fPhfA?loop=1&playlist=HRb7B9fPhfA&start=30'
    },
    urls: [
      yt4 + '/HRb7B9fPhfA?loop=1&list=HRb7B9fPhfA&start=30'
    ]
  }];
  delete tests[1].videoInfo.params;
  tests[2].videoInfo.params.loop = '1';

  assertUrlTest(assert, tests);
});
QUnit.test('Playlist YouTube Urls', function (assert) {
  var vi = {
    provider: 'youtube',
    id: 'yQaAGmHNn9s',
    list: 'PL46F0A159EC02DF82',
    mediaType: 'video',
    params: {
      start: 100
    }
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      long: yt1 + '/watch?list=PL46F0A159EC02DF82&v=yQaAGmHNn9s#t=100',
      embed: yt4 + '/yQaAGmHNn9s?list=PL46F0A159EC02DF82&start=100',
    },
    urls: [
      yt2 + '/watch?v=yQaAGmHNn9s&list=PL46F0A159EC02DF82#t=1m40',
      yt2 + '/watch?v=yQaAGmHNn9s&list=PL46F0A159EC02DF82&t=1m40',
      yt4 + '/yQaAGmHNn9s?list=PL46F0A159EC02DF82&start=100'
    ]
  }, {
    videoInfo: cloneObject(vi),
    formats: {
      long: yt1 + '/watch?list=PL46F0A159EC02DF82&v=yQaAGmHNn9s',
      embed: yt4 + '/yQaAGmHNn9s?list=PL46F0A159EC02DF82',
    },
    urls: [
      yt2 + '/watch?v=yQaAGmHNn9s&list=PL46F0A159EC02DF82',
      yt4 + '/yQaAGmHNn9s?list=PL46F0A159EC02DF82'
    ]
  }, {
    videoInfo: cloneObject(vi),
    formats: {
      long: yt1 +
        '/watch?index=25&list=PL46F0A159EC02DF82&v=6xLcSTDeB7A',
      embed: yt4 + '/6xLcSTDeB7A?index=25&list=PL46F0A159EC02DF82',
    },
    urls: [
      yt3 + '/watch?v=6xLcSTDeB7A&list=PL46F0A159EC02DF82&index=25',
      yt3 + '/watch?v=6xLcSTDeB7A&index=25&list=PL46F0A159EC02DF82',
      yt4 + '/6xLcSTDeB7A?index=25&list=PL46F0A159EC02DF82'
    ]
  }, {
    videoInfo: cloneObject(vi),
    formats: {
      long: yt1 +
        '/watch?index=25&list=PL46F0A159EC02DF82&v=6xLcSTDeB7A#t=100',
      embed: yt4 +
        '/6xLcSTDeB7A?index=25&list=PL46F0A159EC02DF82&start=100',
    },
    urls: [
      yt3 +
      '/watch?v=6xLcSTDeB7A&list=PL46F0A159EC02DF82&index=25#t=1m40',
      yt3 +
      '/watch?v=6xLcSTDeB7A&list=PL46F0A159EC02DF82&index=25&t=1m40',
      yt3 +
      '/watch?v=6xLcSTDeB7A&index=25&list=PL46F0A159EC02DF82&t=1m40',
      yt3 +
      '/watch?v=6xLcSTDeB7A&index=25&list=PL46F0A159EC02DF82#t=1m40',
      yt4 + '/6xLcSTDeB7A?index=25&list=PL46F0A159EC02DF82&start=100'
    ]
  }, {
    videoInfo: {
      provider: 'youtube',
      list: 'PL46F0A159EC02DF82',
      mediaType: 'playlist'
    },
    formats: {
      long: yt1 + '/playlist?feature=share&list=PL46F0A159EC02DF82',
      embed: '//youtube.com/embed?list=PL46F0A159EC02DF82&listType=playlist',
    },
    urls: [
      yt2 + '/embed/videoseries?list=PL46F0A159EC02DF82',
      yt2 + '/playlist?list=PL46F0A159EC02DF82'
    ]
  }, {
    videoInfo: {
      provider: 'youtube',
      list: 'PL46F0A159EC02DF82',
      mediaType: 'playlist',
      params: {
        listType: 'playlist'
      }
    },
    formats: {
      embed: '//youtube.com/embed?list=PL46F0A159EC02DF82&listType=playlist',
    },
    urls: [
      '//youtube.com/embed?list=PL46F0A159EC02DF82&listType=playlist'
    ]
  }];

  delete tests[1].videoInfo.params;
  delete tests[2].videoInfo.params.start;
  tests[2].videoInfo.params.index = tests[3].videoInfo.params.index = '25';
  tests[2].videoInfo.id = tests[3].videoInfo.id = '6xLcSTDeB7A';
  assertUrlTest(assert, tests);
});

QUnit.test('Feed YouTube Urls', function (assert) {
  var tests = [{
    videoInfo: {
      'provider': 'youtube',
      'id': 'HRb7B9fPhfA',
      'mediaType': 'video'
    },
    formats: {
      long: yt1 + '/watch?v=HRb7B9fPhfA',
      short: 'https://youtu.be/HRb7B9fPhfA',
      embed: yt4 + '/HRb7B9fPhfA',
    },
    urls: [
      'https://gdata.youtube.com/feeds/api/videos/HRb7B9fPhfA/related',
      'https://gdata.youtube.com/feeds/api/videos/HRb7B9fPhfA',
      yt3 + '/v/HRb7B9fPhfA'
    ]
  }];
  assertUrlTest(assert, tests);
});

QUnit.test('Image YouTube Urls', function (assert) {
  var vi = {
    provider: 'youtube',
    id: 'HRb7B9fPhfA',
    mediaType: 'video'
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      shortImage: 'https://i.ytimg.com/vi/HRb7B9fPhfA/hqdefault.jpg',
      longImage: yt5 + '/vi/HRb7B9fPhfA/hqdefault.jpg'
    },
    urls: ['https://i.ytimg.com/vi/HRb7B9fPhfA/0.jpg',
      'https://i.ytimg.com/vi/HRb7B9fPhfA/1.jpg',
      'https://i.ytimg.com/vi/HRb7B9fPhfA/2.jpg',
      'https://i.ytimg.com/vi/HRb7B9fPhfA/3.jpg',
      'https://i.ytimg.com/vi/HRb7B9fPhfA/hqdefault.jpg',
      'https://i.ytimg.com/vi/HRb7B9fPhfA/mqdefault.jpg',
      'https://i.ytimg.com/vi/HRb7B9fPhfA/sddefault.jpg',
      'https://i.ytimg.com/vi/HRb7B9fPhfA/maxresdefault.jpg',
      'https://img.youtube.com/vi/HRb7B9fPhfA/0.jpg',
      'https://img.youtube.com/vi/HRb7B9fPhfA/1.jpg',
      'https://img.youtube.com/vi/HRb7B9fPhfA/2.jpg',
      'https://img.youtube.com/vi/HRb7B9fPhfA/3.jpg',
      'https://img.youtube.com/vi/HRb7B9fPhfA/hqdefault.jpg',
      'https://img.youtube.com/vi/HRb7B9fPhfA/mqdefault.jpg',
      'https://img.youtube.com/vi/HRb7B9fPhfA/sddefault.jpg',
      'https://img.youtube.com/vi/HRb7B9fPhfA/maxresdefault.jpg',
    ]
  }];

  assertUrlTest(assert, tests);
});

QUnit.test('Share YouTube Urls', function (assert) {
  var vi = {
    provider: 'youtube',
    id: 'E14kBrDEvYo',
    mediaType: 'share'
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      long: 'https://www.youtube.com/shared?ci=E14kBrDEvYo'
    },
    urls: ['https://www.youtube.com/shared?ci=E14kBrDEvYo']
  }];

  assertUrlTest(assert, tests);
});

var vk1 = 'http://static.youku.com/v1.0.0638/v/swf/';
QUnit.test('Youku Urls', function (assert) {
  var vi = {
    'provider': 'youku',
    'id': 'XMTQ3OTM4MzMxMg',
    'mediaType': 'video'
  };
  var tests = [{
    videoInfo: cloneObject(vi),
    formats: {
      embed: 'http://player.youku.com/embed/XMTQ3OTM4MzMxMg',
      long: 'http://v.youku.com/v_show/id_XMTQ3OTM4MzMxMg',
      flash: 'http://player.youku.com/player.php/sid/XMTQ3OTM4MzMxMg/v.swf',
      static: vk1 + 'loader.swf?VideoIDS=XMTQ3OTM4MzMxMg'
    },
    urls: [
      'http://player.youku.com/embed/XMTQ3OTM4MzMxMg',
      'http://player.youku.com/player.php/sid/XMTQ3OTM4MzMxMg==/v.swf',
      'http://v.youku.com/v_show/id_XMTQ3OTM4MzMxMg',
      vk1 + 'loader.swf?VideoIDS=XMTQ3OTM4MzMxMg%3D%3D'
    ]
  }];

  assertUrlTest(assert, tests);
});

})();