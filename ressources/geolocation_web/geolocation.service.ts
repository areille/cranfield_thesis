import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Http } from '@angular/http';

import { Location } from './location.model';

@Injectable()

export class GeolocationService {
    private googleApiKey = 'AIzaSyB5lcMKPC2rATzFuybertSFovJlmVWM7Do';

    constructor(private http: Http) { }

    public getPositionFromAddress(address: string): Observable<any> {
        return this.http.get('https://maps.googleapis.com/maps/api/geocode/json?address=' +
            address + '&key=' + this.googleApiKey)
            .map(
                (response) => {
                    let json = response.json();
                    return json.results[0].geometry.location;
                }
            )
            .catch(this.handleError);
    }

    public getAddressFromPosition(position: Location): Observable<string> {
        let queryParam = position.lat.toString() + ',' + position.lng.toString();
        return this.http.get('https://maps.googleapis.com/maps/api/geocode/json?latlng=' +
            queryParam + '&key=' + this.googleApiKey)
            .map(
                (response) => {
                    let json = response.json();
                    return json.results[0].formatted_address;
                }
            )
            .catch(this.handleError);
    }

    private handleError(error: any): Promise<any> {
        console.error('An error occurred in google maps request', error);
        return Promise.reject(error.message || error);
    }
}
