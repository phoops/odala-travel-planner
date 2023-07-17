import pick from 'lodash/pick';
import Relay from 'react-relay/classic';

import { circle } from 'leaflet';
import { StopAlertsQuery } from '../../../util/alertQueries';
import { drawTerminalIcon } from '../../../util/mapIconUtils';
import { isFeatureLayerEnabled } from '../../../util/mapLayerUtils';
import throttle from 'lodash-es/throttle'
/**
 * The period of time, in ms, to have the results cached.
 */
const CACHE_PERIOD_MS = 1000 * 60 * 5; // 5 minutes
const cache = {};

function debounce(func, wait, immediate) {
  let timeout;

  return function executedFunction(...args) {
    const context = this;

    const later = function laterApply() {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    };

    const callNow = immediate && !timeout;

    clearTimeout(timeout);

    timeout = setTimeout(later, wait);

    if (callNow) {
      func.apply(context, args);
    }
  };
}

class MintStops {
  constructor(
    tile,
    config,
    mapLayers,
    getCurrentTime = () => new Date().getTime(),
  ) {
    this.tile = tile;
    this.config = config;
    this.mapLayers = mapLayers;
    this.debouncedFetch = debounce(() => this.fetchStops(), 3000);
    this.promise = this.getPromise();
    this.getCurrentTime = getCurrentTime;
  }

  static getName = () => 'stop';

  getPromise() {
    console.log('debounced get')
    this.debouncedFetch();
  }

  clearStops() {
    const leafletMap = this.tile.props.leaflet.map;
    for (const i in leafletMap._layers) {
      if (leafletMap._layers[i]._path != undefined) {
        try {
          leafletMap.removeLayer(leafletMap._layers[i]);
        } catch (e) {
          console.log(`problem with ${e}${leafletMap._layers[i]}`);
        }
      }
    }
  }

  drawStop(feature) {
    if (
      !isFeatureLayerEnabled(
        feature,
        MintStops.getName(),
        this.mapLayers,
        this.config,
      )
    ) {
      return;
    }

    const color = feature.properties.type === 'BUS' ? '#0279c9' : feature.properties.type === 'TRAM' ? '#00985f' : '#8c4799';
    circle(feature.geom, {
      radius: 4,
      color: color,
      fillColor: '#ffffff',
      fillOpacity: 1,
    }).addTo(this.tile.props.leaflet.map);
  }

  fetchStatusAndDrawStop = (stopFeature, large) => {
    const { gtfsId } = stopFeature.properties;
    const query = Relay.createQuery(
      Relay.QL`
        query StopStatus($id: String!) {
          stop(id: $id) {
            ${StopAlertsQuery}
          }
        }
      `,
      { id: gtfsId },
    );

    const currentTime = this.getCurrentTime();
    const callback = () => {
      cache[gtfsId] = currentTime;
      this.drawStop(stopFeature);
    };

    const latestFetchTime = cache[gtfsId];
    if (latestFetchTime && latestFetchTime - currentTime < CACHE_PERIOD_MS) {
      Relay.Store.primeCache({ query }, callback);
    } else {
      Relay.Store.forceFetch({ query }, callback);
    }
  };

  getTileBoundingBox(tile, zoom) {
    const x = tile.coords.x;
    const y = tile.coords.y;
    function tile2lon(x, z) {
      return x / Math.pow(2, z) * 360 - 180;
    }
    function tile2lat(y, z) {
      const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
      return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }

    const north = tile2lat(y, zoom);
    const south = tile2lat(y + 1, zoom);
    const west = tile2lon(x, zoom);
    const east = tile2lon(x + 1, zoom);

    return {
      minLat: north,
      minLon: west,
      maxLat: south,
      maxLon: east,
    };
  }

  fetchStops() {
    const byBoundingBox = this.getTileBoundingBox(
      this.tile,
      this.tile.coords.z,
    );
    const poiUrl = new URL(this.config.URL.STOP);
    poiUrl.search = new URLSearchParams({
      ...byBoundingBox,
      types: 'bus-stop,rail-stop,tram-stop',
    });
    if (this.tile.coords.z <= this.config.stopsMinZoom) {
      console.log('request skipped', this.tile.coords.z);
      // clear markers if present
      const leafletMap = this.tile.props.leaflet.map;
      if (leafletMap._layers.length != 0) {
        this.clearStops();
      }
      return;
    }
    return fetch(poiUrl.toString()).then(res => {
      if (res.status !== 200) {
        return undefined;
      }

      return res.json().then(
        json => {
          // skip empty response
          if (!json.data || json.data.length === 0) {
            return;
          }
          const stopsForLayers = {
            layers: {
              stops: json.data.map(poi => ({
                geom: {
                  lng: poi.position.lon,
                  lat: poi.position.lat,
                },
                properties: {
                  gtfsId: poi.additionalData.gtfsId,
                  name: poi.additionalData.name,
                  code: poi.additionalData.code,
                  platform: null,
                  desc: `Fermata ${poi.additionalData.name}`,
                  parentStation: null,
                  type: poi.additionalData.routeType,
                  patterns: JSON.stringify([
                    {
                      headsign: poi.additionalData.name,
                      shortName: poi.additionalData.name,
                      type: poi.additionalData.routeType,
                    },
                  ]),
                },
              })),
            },
          };
          this.features = [];

          if (
            stopsForLayers.layers.stops != null &&
            this.tile.coords.z >= this.config.stopsMinZoom
          ) {
            const featureByCode = {};

            for (
              let i = 0, ref = stopsForLayers.layers.stops.length - 1;
              i <= ref;
              i++
            ) {
              const feature = stopsForLayers.layers.stops[i];
              if (
                feature.properties.type &&
                (feature.properties.parentStation === 'null' ||
                  this.config.terminalStopsMaxZoom - 1 <=
                    this.tile.coords.z + (this.tile.props.zoomOffset || 0))
              ) {
                const f = {
                  geom: feature.geom,
                  properties: feature.properties,
                };
                if (f.properties.code && this.config.mergeStopsByCode) {
                  /* a stop may be represented multiple times in data, once for each transport mode
                     Latest stop erares underlying ones unless the stop marker size is adjusted accordingly.
                     Currently we expand the first marker so that double stops are visialized nicely.
                   */
                  const prevFeature = featureByCode[f.properties.code];
                  if (
                    !prevFeature ||
                    prevFeature.properties.type > f.properties.type
                  ) {
                    featureByCode[f.properties.code] = f;
                  }
                }
                this.features.push(f);
              }
            }
            if (this.config.mergeStopsByCode) {
              /* sort the stops by type so that double stops get consistent visual appearance.
                For example, draw tram stops before bus stops */
              this.features.sort((f1, f2) => {
                if (f1.properties.type > f2.properties.type) {
                  return -1;
                }
                if (f2.properties.type > f1.properties.type) {
                  return 1;
                }
                if (f1.properties.platform) {
                  /* favor stops with platform code over those without it */
                  return 1;
                }
                return 0;
              });
            }
            this.features.forEach(f => {
              /* Note: don't expand separate stops sharing the same code,
                 unless type is different and location actually overlaps. */
              const large =
                this.config.mergeStopsByCode &&
                f.properties.code &&
                featureByCode[f.properties.code] !== f &&
                featureByCode[f.properties.code].properties.type !==
                  f.properties.type &&
                f.geom.x === featureByCode[f.properties.code].geom.x &&
                f.geom.y === featureByCode[f.properties.code].geom.y;
              this.fetchStatusAndDrawStop(f, large);
            });
          } else if (this.tile.coords.z <= this.config.stopsMinZoom) {
            this.clearStops();
            // when we are not drawing the stop circles we can check if
            // we should clear all the stops drawed according to the zoom level
          }

          if (
            stopsForLayers.layers.stations != null &&
            this.config.terminalStopsMaxZoom >
              this.tile.coords.z + (this.tile.props.zoomOffset || 0) &&
            this.tile.coords.z >= this.config.terminalStopsMinZoom
          ) {
            for (
              let i = 0, ref = stopsForLayers.layers.stations.length - 1;
              i <= ref;
              i++
            ) {
              const feature = stopsForLayers.layers.stations.feature(i);
              if (
                feature.properties.type &&
                isFeatureLayerEnabled(
                  feature,
                  'terminal',
                  this.mapLayers,
                  this.config,
                )
              ) {
                [[feature.geom]] = feature.loadGeometry();
                this.features.unshift(pick(feature, ['geom', 'properties']));
                drawTerminalIcon(
                  this.tile,
                  feature.geom,
                  feature.properties.type,
                  this.tile.coords.z >= this.config.terminalNamesZoom
                    ? feature.properties.name
                    : false,
                );
              }
            }
          }
        },
        err => console.log(err), // eslint-disable-line no-console
      );
    });
  }
}

export default MintStops;
