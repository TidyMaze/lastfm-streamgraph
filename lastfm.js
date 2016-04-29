request = require('request')
q = require('q')

const USER = 'xela85'
const API_KEY = 'ceab33e935ee4f339d2866a0f263507a'
const HOST = 'http://ws.audioscrobbler.com'
const NB_WEEK = 40

function printProgress(cur, max, message){
  console.log(parseInt(cur * 100 / max) + ' % ' + message)
}

function sortedKeysOf(obj){
  var keys = Object.keys(obj)
  keys.sort()
  return keys
}

/* Retourne une promesse un tableau JS 2D (data) et les labels {data, labels} */
function getData(){
  var deferred = q.defer()

  request({
    url: `${HOST}/2.0/?method=user.getweeklychartlist&user=${USER}&api_key=${API_KEY}&format=json`,
    json: true
  }, function (error, response, body) {
    var periodes = body.weeklychartlist.chart.map((chart,index) => {
      return { from: parseInt(chart.from), to: parseInt(chart.to) }
    })
    periodes = periodes.slice(periodes.length - NB_WEEK, periodes.length)
    console.log('Nb periodes : ' + periodes.length)

    /* Retourne une promesse contenant la mapPeriodesArtistes */
    function getAllArtistsByPeriods(){
      var deferredArtists = q.defer()

      var count = 0
      var mapPeriodesArtistes = {}

      periodes.forEach(p => {
        var dFrom = p.from
        var dTo = p.to
        request({
          url: `${HOST}/2.0/?method=user.getweeklyartistchart&user=${USER}&from=${dFrom}&to=${dTo}&api_key=${API_KEY}&format=json`,
          json: true
        }, function (error, response, body) {
          if(error){
            console.log('erreur :' + error);
          }
          count += 1
          printProgress(count, periodes.length, 'HTTP ' + response.statusCode)

          var artistsOfPeriode = body.weeklyartistchart.artist
            .map((art,index) => { return { name: art.name, playcount: parseInt(art.playcount), mbid: art.mbid } })
            .filter(art => art.playcount > 0 && art.mbid && art.name )
            .slice(0,4);

          if(artistsOfPeriode.length > 0){
            mapPeriodesArtistes[dFrom] = artistsOfPeriode
          }

          if(count == periodes.length){
            deferredArtists.resolve(mapPeriodesArtistes)
          }
        });
      })
      return deferredArtists.promise
    }

    getAllArtistsByPeriods().then(mapPeriodesArtistes => {
      /* Traite les donnés et réalise la promesse */

      /* Tous les artistes */
      var tousArtistes = {}
      sortedKeysOf(mapPeriodesArtistes).forEach(key=>{
        value = mapPeriodesArtistes[key]
        value.forEach(art => {
            tousArtistes[art.mbid] = art.name
            console.log(key + " = " + art.name + ' ' + art.playcount + ' ' + art.mbid)
          }
        )
      })

      /* Map d'un artiste vers ses périodes et pour chaque période le playcount */
      var artisteVersPeriode = {}
      for(i in tousArtistes){
        console.log('Lectures de ' + a + ' (' + i + ') :')
        var a = tousArtistes[i]
        var periodes = new Map()
        for(periode in mapPeriodesArtistes){
          var artistes = mapPeriodesArtistes[periode]
          var sum = artistes.map(art=>art.playcount).reduce((previousValue, currentValue, currentIndex, array) => previousValue + currentValue);
          console.log(sum)
          var artistInPeriode = artistes.find(art=>art.mbid == i)
          if(artistInPeriode){
            periodes.set(periode, artistInPeriode.playcount)
            //periodes.set(periode, parseInt(artistInPeriode.playcount * 100 / sum))
            //console.log(periode + ' -> ' + parseInt(artistInPeriode.playcount * 100 / sum))
          }
        }
        artisteVersPeriode[i] = periodes
      }

      /* Crée le tableau 2D contenant une ligne par artiste et une
      colonne par période avec comme valeur le playcount */
      var finalTab = []
      var lib = []
      sortedKeysOf(artisteVersPeriode).forEach(key => {
        lib.push(tousArtistes[key])
        finalTab.push(sortedKeysOf(mapPeriodesArtistes).map(keyPeriode =>
          artisteVersPeriode[key].get(keyPeriode) || 0
        ))
      })

      /* Réalisation de la promesse */
      deferred.resolve({data: finalTab, labels: lib})
    })
  });

  return deferred.promise
}

var express = require('express');
var app = express();

app.get('/data', function (req, res) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Credentials', true)
  res.header('Access-Control-Allow-Methods', 'POST, GET, PUT')

  getData().then(data=>{
    console.log(data)
    res.send(JSON.stringify(data));
    console.log('fin !')
  })
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
