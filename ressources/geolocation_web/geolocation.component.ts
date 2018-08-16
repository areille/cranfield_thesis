import { Component, OnInit, Input, EventEmitter, Output, NgZone } from '@angular/core';

import { GeolocationService } from './geolocation.service';
import { Location } from './location.model';
import { Address } from './address.model';
// tslint:disable-next-line:import-destructuring-spacing
import { } from '@types/googlemaps';

import * as _ from 'lodash';
import { ToasterService } from 'angular2-toaster';

@Component({
    selector: 'xen-geolocation',
    templateUrl: './geolocation.template.html',
    styleUrls: ['./geolocation.style.scss']
})

export class GeolocationComponent implements OnInit {

    @Input() public geolocEnabled = false;
    @Input() public locations: Location[] = [];
    @Output() public onLocationSet: EventEmitter<any> = new EventEmitter();
    public searchAddress = '';
    public selectedAddress: Address = null;
    public focusTriggerEvent = new EventEmitter<boolean>();
    public addresses: Address[] = [];
    private map: google.maps.Map;
    private isInList = false;

    constructor(
        private geolocationService: GeolocationService,
        private toasterService: ToasterService,
        private zone: NgZone,
    ) { }

    public ngOnInit(): void {
        this.map = new google.maps.Map(document.getElementById('map'),
            {
                zoom: 12,
                center: { lat: 48.8569485, lng: 2.3356883 },
                streetViewControl: false,
                fullscreenControl: false
            });
        if (this.geolocEnabled) {

            _.forEach(this.locations, (loc: Location, index) => {
                this.addresses[index] = {
                    formattedAddress: '',
                    location: loc,
                    selected: index === 0 ? true : false,
                    associatedMarker: new google.maps.Marker({
                        map: this.map,
                        position: new google.maps.LatLng(loc.lat, loc.lng),
                        animation: google.maps.Animation.DROP
                    })
                };
                this.addresses[index].associatedMarker.addListener(('click'), () => {
                    this.selectAddress(this.addresses[index]);
                });
                this.searchAddressFromLocation(loc)
                    .subscribe(
                        (address) => {
                            this.addresses[index].formattedAddress = _.clone(address);
                        },
                        (error) => {
                            console.error('Address search error : ', error);
                        },

                );
            });
            this.map.setCenter(_.filter(this.addresses, (a) => {
                return a.selected;
            })[0].location);
            // center: _.chain(this.addresses)
            //     .filter((a) => a.selected)
            //     .map((a) => a.location)[0]
            //     .value(),)
        }

        let input: any = document.getElementById('input');
        input.addEventListener('keypress', (event) => {
            if (event.keyCode === 13) {
                this.searchAddress = input.value;
                this.formatAddress();
            }
        });
        let autocomplete = new google.maps.places.Autocomplete(input);
        autocomplete.addListener('place_changed', () => {
            this.searchAddress = autocomplete.getPlace().formatted_address;
            this.setSelectedAddress();
        });
    }

    public formatAddress() {
        let loc: Location;
        this.searchLocationFromAddress(this.searchAddress)
            .subscribe(
                (res) => loc = _.clone(res),
                (err) => {
                    this.toasterService.pop(
                        'error',
                        'Error :',
                        'Invalid address'
                    );
                    console.error('Error => ', err);
                },
                () => {
                    this.searchAddressFromLocation(loc)
                        .subscribe(
                            (address) => this.searchAddress = _.clone(address),
                            (err) => console.error(err),
                            () => {
                                this.setSelectedAddress();
                            }
                        );
                }
            );
    }

    public setSelectedAddress() {
        if (this.searchAddress && this.searchAddress.length) {
            if (this.selectedAddress && this.selectedAddress.associatedMarker) {
                this.selectedAddress.associatedMarker.setMap(null);
            }
            this.zone.run(() => {
                this.selectedAddress = {
                    formattedAddress: this.searchAddress,
                    selected: true,
                    location: null,
                    associatedMarker: null
                };
                this.selectAddress(this.selectedAddress);
            });
            this.searchLocationFromAddress(this.searchAddress)
                .subscribe(
                    (location: Location) => {
                        this.selectedAddress.location = _.clone(location);
                    },
                    (error) => { console.error('Error finding coords from address : ', error); },
                    () => {
                        this.selectedAddress.associatedMarker = new google.maps.Marker({
                            map: this.map,
                            position: new google.maps.LatLng(this.selectedAddress.location.lat, this.selectedAddress.location.lng),
                            animation: google.maps.Animation.DROP
                        });
                        this.selectedAddress.associatedMarker.addListener(('click'), () => {
                            this.selectAddress(this.selectedAddress);
                        });
                        this.map.setCenter(this.selectedAddress.location);
                        this.map.setZoom(14);
                        let match = _.filter(this.addresses, (a: Address) => {
                            return a.location.lat === this.selectedAddress.location.lat && a.location.lng === this.selectedAddress.location.lng;
                        });
                        if (match && match.length) {
                            this.isInList = true;
                        } else {
                            this.isInList = false;
                        }
                    }
                );
        }
    }

    public searchLocationFromAddress(address: string) {
        return this.geolocationService.getPositionFromAddress(address);
    }

    public searchAddressFromLocation(location: Location) {
        return this.geolocationService.getAddressFromPosition(location);
    }

    public setLocation() {
        if (this.enableGeolocation) {
            this.onLocationSet.emit(this.locations);
        }
    }

    public addAddress(address: Address) {
        this.searchAddress = '';
        this.selectedAddress = null;
        google.maps.event.clearInstanceListeners(address.associatedMarker);
        address.associatedMarker.addListener(('click'), () => {
            this.selectAddress(address);
        });
        _.map(this.addresses, (a) => a.selected = false);
        this.addresses.push(address);
        this.updateGeoloc();
    }

    public removeAddress(address: Address) {
        if (address.associatedMarker) {
            address.associatedMarker.setMap(null);
        }
        _.remove(this.addresses, (a: Address) => {
            return _.isEqual(address, a);
        });
        if (this.addresses.length && (this.selectedAddress === null)) {
            this.map.setCenter(this.addresses[0].location);
            this.addresses[0].selected = true;
        } else if (this.selectedAddress === null) {
            this.map.setCenter(new google.maps.LatLng(48.8569485, 2.3356883));
            this.map.setZoom(12);
        }
        this.updateGeoloc();
    }

    public selectAddress(address: Address) {
        // this.zone.run(() => {
        _.map(this.addresses, (a) => a.selected = false);
        if (this.selectedAddress) {
            this.selectedAddress.selected = false;
        }
        address.selected = true;
        // });
        this.map.setCenter(address.location);
        this.map.setZoom(14);
    }

    public updateGeoloc() {
        this.locations = [];
        _.map(this.addresses, (a, index) => {
            this.locations[index] = a.location;
        });
        this.onLocationSet.emit({ locations: this.locations, enabled: this.geolocEnabled });
    }

    public goToSearch() {
        this.focusTriggerEvent.emit(true);
        let el = document.getElementById('input');
        el.scrollIntoView({ behavior: 'smooth' });
    }

    public removeSearchAddress() {
        this.searchAddress = '';
        this.selectedAddress.associatedMarker.setMap(null);
        this.selectedAddress = null;
        if (this.addresses.length) {
            this.map.setCenter(this.addresses[0].location);
            this.addresses[0].selected = true;
        } else {
            this.map.setCenter(new google.maps.LatLng(48.8569485, 2.3356883));
            this.map.setZoom(12);
        }
    }

    public enableGeolocation() {
        this.geolocEnabled = !this.geolocEnabled;
        if (!this.geolocEnabled) {
            this.addresses = [];
        }
        this.updateGeoloc();
    }
}
