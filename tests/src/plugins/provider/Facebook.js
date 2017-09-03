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

