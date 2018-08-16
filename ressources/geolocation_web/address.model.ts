import { Location } from './location.model';

export class Address {
    public formattedAddress: string;
    public location: Location;
    public selected: boolean;
    public associatedMarker: google.maps.Marker;
}
