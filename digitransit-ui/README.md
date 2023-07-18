#  ODALA Travel Planner - Digitransit UI

ODALA travel planner web ui.

## Licensing
The source code of the platform is dual-licensed under the EUPL v1.2 and AGPLv3 licenses.


## Develop

You can run the project directly with `docker-compose`

```bash
    docker-compose up
```

For development purpose you can run the project with the command

```
CONFIG=odala yarn run dev
```

Odala configuration parameters are all on the file `app/configurations/config.odala.js`. The parameter `CONFIG=odala` loads the configuration file at startup.

Default ODALA theme is a generic theme with ODALA project logo and color palette, it can be used as as starting point for more specific configuration.

This custom version of Digitransit-UI uses Mapbox geoconding APIs for geocoding, reverse geocoding and autocomplete functions. You must insert a valid Mapbox access token in configuration file:

```
APBOX_ACCESS_TOKEN: 'YOUR_MAPBOX_ACCESS_TOKEN_HERE'
```



## Documentation

* [Terms](docs/Terms.md)
* [Architecture](docs/Architecture.md)
* [Positioning](docs/Position.md)
* [Locations](docs/Location.md)
* [Z-Index Index](docs/ZIndex.md)
* [Navigation](docs/Navigation.md)
* [Themes](docs/Themes.md)
