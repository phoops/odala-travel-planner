import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router';
import { FormattedMessage } from 'react-intl';
import AddIcon from './AddIcon';
import ComponentUsageExample from './ComponentUsageExample';
import { addAnalyticsEvent } from '../util/analyticsUtils';

const EmptyFavouriteLocationSlot = ({ index }) => (
  <Link
    id={`add-new-favourite-${index}`}
    to="/suosikki/uusi"
    className="cursor-pointer no-decoration"
    key={`add-new-favourite-${index}`}
    onClick={() => {
      addAnalyticsEvent({
        category: 'Favourite',
        action: 'AddLocationAsFavourite',
        name: null,
      });
    }}
  >
    <div className="new-favourite-button-content">
      <AddIcon />
      <p className="add-location-text">
        <FormattedMessage id="add-location" defaultMessage="Add location" />
      </p>
    </div>
  </Link>
);

EmptyFavouriteLocationSlot.displayName = 'EmptyFavouriteLocationSlot';

EmptyFavouriteLocationSlot.description = () => (
  <div>
    <p>Renders a empty favourite location slot component</p>
    <ComponentUsageExample description="none">
      <EmptyFavouriteLocationSlot />
    </ComponentUsageExample>
  </div>
);

EmptyFavouriteLocationSlot.propTypes = {
  index: PropTypes.number.isRequired,
};

export default EmptyFavouriteLocationSlot;
