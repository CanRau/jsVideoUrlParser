function Facebook() {
  this.provider = 'facebook';
  this.alternatives = ['fb'];
  this.defaultFormat = 'long';
  this.formats = {
    long: this.createLongUrl,
    short: this.createShortUrl,
    longImage: this.createImageUrl
  };
  this.mediaTypes = {
    VIDEO: 'video'
  };
}

Facebook.prototype.parseUrl = function (url) {
  var match = url.match(/^.+\/(.+)?\/videos\/(\d+)+|v=(\d+)|vb.\d+\/(\d+)/i);
  return {
    id: match ? match[2] || match[3] || match[4] : undefined,
    user: match ? match[1] : undefined
  };
};

Facebook.prototype.parse = function (url, params) {
  var parsedUrl = this.parseUrl(url);

  if (!parsedUrl.id) {
    return undefined;
  }

  var result = {
    mediaType: this.mediaTypes.VIDEO,
    params: params,
    id: parsedUrl.id,
    user: parsedUrl.user
  };

  return result;
};

Facebook.prototype.createUrl = function (baseUrl, vi, params) {
  var url = baseUrl + vi.id;
  url += combineParams({
    params: params
  });
  return url;
};

Facebook.prototype.createShortUrl = function (vi, params) {
  return this.createUrl('https://fb.com/', vi, params);
};

Facebook.prototype.createLongUrl = function (vi, params) {
  var url = 'https://www.facebook.com/';
  if (vi.user) {
    url += vi.user + '/';
  }
  url += 'videos/';
  return this.createUrl(url, vi, params);
};

Facebook.prototype.createEmbedUrl = function (vi, params) {
  return this.createUrl('//facebook.com/embed/', vi, params);
};

Facebook.prototype.createImageUrl = function (vi, params) {
  var url = 'https://graph.facebook.com/';
  url += vi.id;
  url += '/picture';
  return url;
};

urlParser.bind(new Facebook());
