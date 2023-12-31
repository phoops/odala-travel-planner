import PropTypes from 'prop-types';
import React from 'react';

import TileLayerContainer from './TileLayerContainer';
import CityBikes from './CityBikes';
import ParkAndRide from './ParkAndRide';
import TicketSales from './TicketSales';
import MintStops from './MintStops';

export default function VectorTileLayerContainer(props, { config }) {
  const layers = [];

  if (props.showStops) {
    layers.push(MintStops);

    if (config.cityBike && config.cityBike.showCityBikes) {
      layers.push(CityBikes);
    }

    if (config.parkAndRide && config.parkAndRide.showParkAndRide) {
      layers.push(ParkAndRide);
    }

    if (config.ticketSales && config.ticketSales.showTicketSales) {
      layers.push(TicketSales);
    }
  }

  return (
    <TileLayerContainer
      key="tileLayer"
      layers={layers}
      hilightedStops={props.hilightedStops}
      tileSize={config.map.tileSize || 256}
      zoomOffset={config.map.zoomOffset || 0}
      disableMapTracking={props.disableMapTracking}
    />
  );
}

VectorTileLayerContainer.propTypes = {
  hilightedStops: PropTypes.arrayOf(PropTypes.string.isRequired),
  disableMapTracking: PropTypes.func,
  showStops: PropTypes.bool,
};

VectorTileLayerContainer.contextTypes = {
  config: PropTypes.object.isRequired,
};
