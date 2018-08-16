import { NavController, Platform, App, ViewController, LoadingController, ModalController, NavParams } from "ionic-angular";
import { Component, ViewChild, ElementRef, NgZone } from "@angular/core";
import { Geolocation, Geoposition } from '@ionic-native/geolocation';
import * as _ from 'lodash';

import { BasePage } from "../base-page";
import { RewardCardModel, RewardCardTransform } from '../../components/reward-card';

import { MobileService } from '../../providers/mobile';
import { Brand } from "../../providers/brand";
import { DBService } from "../../providers/db";
import { Sport, SportService } from "../../providers/sport";
import { SettingsService, Settings } from "../../providers/settings";
import { FiltersPage } from '../rewards/filters/filters';
import { AthleteService } from "../../providers/athlete";
import { FilterService, FilterModel } from "../../providers/filter";

import { } from '@types/googlemaps';
import { LaunchNavigator } from '@ionic-native/launch-navigator';

import { CustomMarker } from './custom-marker';
import { Diagnostic } from "@ionic-native/diagnostic";

@Component({
    selector: 'page-geolocation',
    templateUrl: 'geolocation.html',
    providers: [Geolocation, Diagnostic]
})
export class GeolocationPage extends BasePage {


    @ViewChild('map') mapElement: ElementRef;
    mapReady: boolean = false;
    private map: any;
    private markers: any[] = [];
    private infoWindows: google.maps.InfoWindow[] = [];
    private userLoc: google.maps.LatLng = new google.maps.LatLng(46.7757315, 1.6757303); //france default
    private showVouchers: boolean = false;
    private vouchers: RewardCardModel[] = [];
    public displayedVouchers: RewardCardModel[] = [];
    private sports: Sport[];
    private favoriteSport: Sport;
    public filter_: FilterModel;
    public enabledGPS: boolean = false;
    constructor(
        public navCtrl: NavController,
        public platform: Platform,
        public mobileService: MobileService,
        public app: App,
        public viewCtrl: ViewController,
        public db: DBService,
        private geolocation: Geolocation,
        private zone: NgZone,
        public loadingCtrl: LoadingController,
        public rewardCardTransform: RewardCardTransform,
        public settingsService: SettingsService,
        public sportService: SportService,
        public athleteService: AthleteService,
        public modalCtrl: ModalController,
        public navParams: NavParams,
        public filterService: FilterService,
        private launchNavigator: LaunchNavigator,
        private diagnostic: Diagnostic

    ) {
        super(platform, mobileService, app, viewCtrl.name);
        this.filter_ = this.filterService.getFilters();
    }
    public onResume() {
        this.ionViewDidEnter();
    }
    public refresh() {
        this.filter_ = this.filterService.getFilters();
        this.settingsService.getCurrentSettings().subscribe(
            (settings: Settings) => {
                this.sports = this.sportService.listFromLocal();
                this.favoriteSport = _.find(this.sports, { key: settings.favoriteSport.key });
                if (this.favoriteSport) {
                    if (this.filter_.isFiltered) {
                        this.vouchers = this.rewardCardTransform.getFilterRewards(this.athleteService.getFromLocal(), this.favoriteSport, this.filter_);
                    } else {
                        this.vouchers = this.rewardCardTransform.getAllRewards(this.athleteService.getFromLocal(), this.favoriteSport);
                    }
                }
                // remove distance element
                _.map(this.vouchers, v => {
                    if(v.distance)
                        delete v.distance;
                });
                this.reloadDisplayedBrands();
                this.reCenter();
            }
        )
    }

    public reloadDisplayedBrands() {
        _.forEach(this.markers, (m) => {
            m.setMap(null);
        });
        this.markers = [];
        let displayedBrands: Brand[] = _.filter(this.db.instantModel.brands, (b: Brand) => {
            if ((b.location || (b.locations && b.locations.length))
                && b.stores[0].voucherUuids && b.stores[0].voucherUuids.length) {

                let brandToDisplay:RewardCardModel[] = _.filter(this.vouchers, (v: RewardCardModel) => {
                    return _.includes(b.stores[0].voucherUuids, v.uuid) && v.isRetail;
                })
                return (brandToDisplay && brandToDisplay.length);
            }
        });

        _.forEach(displayedBrands, (b: Brand) => {

            if(b && b.locations && b.locations.length) {
                for(let i = 0; i < b.locations.length; i++) {
                    this.createMarker(b.name, b.logoPictureUrl, b.locations[i], b.stores[0].voucherUuids);
                }
            }
            else {
                this.createMarker(b.name, b.logoPictureUrl, b.location, b.stores[0].voucherUuids);
            }
        });
    }

    private createMarker(
        name: string,
        logo: string,
        location: { lat: number, lng: number },
        voucherUuids: string[]
    ) {
        let brandLoc = new google.maps.LatLng(location.lat, location.lng);

        // CREATION ON INFO WINDOW
        this.displayedVouchers = _.filter(this.vouchers, (v: RewardCardModel) => {
            return _.includes(voucherUuids, v.uuid) && v.isRetail;
        });
        let distance = this.transformDistance(
            this.rewardCardTransform.calculateDistance(this.userLoc.lat(), location.lat, this.userLoc.lng(), location.lng)
        );

        let window = document.createElement('div');
        window.style.display = 'flex';
        window.style.marginTop = '4px';
        window.innerHTML =
            '<div style="display: flex; align-items: center; padding-right: 10px; font-size: 1.8em;' +
            '           color: lightseagreen;border-right: 1px solid lightgray;">' +
            '   <img style="max-height: 28px; filter: invert(49%) sepia(84%) saturate(2023%) hue-rotate(144deg) brightness(97%) contrast(102%);"' +
            '        src="assets/icon_route@3x.png"/>' +
            '</div>' +
            '<div style="display: flex; flex-direction: column; padding-left: 10px;">' +
            '   <div>' + name + '</div>' +
            '   <div>' + distance + '</div>' +
            '</div>'
        window.addEventListener('click', (event) => {
            this.navigate();
        });
        let infowindow = new google.maps.InfoWindow({
            content: window,
            position: brandLoc
        });
        // --------


        let marker = new CustomMarker(brandLoc, this.map, logo);
        marker['associatedVouchers'] = voucherUuids;
        marker['isActive'] = false;
        marker.addListener('click', (event) => {
            this.onMarkerClicked(marker, infowindow);
        });
        this.markers.push(marker);
        this.infoWindows.push(infowindow);

    }

    public ionViewDidEnter() {
        this.filter_ = this.filterService.getFilters();
        this.loadMap();
    }

    loadMap() {
        if (this.platform.is('cordova')) {
            this.diagnostic.isGpsLocationEnabled().then(
                (isEnabled: boolean) => {
                    if (isEnabled) {
                        this.treatAuthPosition();
                    }
                    else {
                        this.enabledGPS = false;
                        this.createMap();
                    }
                });
        }
        else {
            this.treatAuthPosition();
        }
    }
    public treatAuthPosition() {
        this.geolocation.getCurrentPosition().then((resp: Geoposition) => {
            let tmpGeoPos: google.maps.LatLng = new google.maps.LatLng(resp.coords.latitude, resp.coords.longitude);
            if (!_.isEqual(this.userLoc, tmpGeoPos)) {
                let loading = this.loadingCtrl.create({ spinner: 'crescent', showBackdrop: true, cssClass: 'loading' });
                loading.present();
                this.enabledGPS = true;
                this.userLoc = tmpGeoPos;
                this.createMap();
                loading.dismiss();
            }
        }).catch((error) => {
            console.log('Error getting location', error);
            this.enabledGPS = false;
            this.createMap();
        });
    }
    public createMap() {
        // disables points of interests, monuments, transit station etc.
        let style = [
            {
                featureType: 'poi',
                stylers: [
                    { visibility: 'off' }
                ]
            },
            {
                featureType: 'transit',
                stylers: [
                    { visibility: 'off' }
                ]
            }
        ]
        // Type any because an error was thrown while doc spec was respected.
        // see https://developers.google.com/maps/documentation/javascript/style-reference#style-features
        let mapOptions: any = {
            center: this.userLoc,
            zoom: this.enabledGPS ? 14 : 5,
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false,
            disableDefaultUI: true,
            styles: style
        }
        // Creates map
        if (this.mapElement) {
            this.map = new google.maps.Map(this.mapElement.nativeElement, mapOptions);
            this.map.addListener('drag', () => {
                this.onMapClicked();
            })
        }
        if (this.enabledGPS) {
            // Creates user marker
            let userIcon = {
                url: 'assets/icon/pointer_self_hq.png',
                scaledSize: new google.maps.Size(28, 28)
            }
            new google.maps.Marker(
                {
                    map: this.map,
                    position: this.userLoc,
                    icon: userIcon,
                    animation: google.maps.Animation.DROP,
                    zIndex: 105
                }
            );
        }
        this.refresh();

    }
    public onMarkerClicked(marker: CustomMarker, infowindow: google.maps.InfoWindow) {
        this.zone.run(
            () => {
                // Case no selected brand
                if (!this.showVouchers) {
                    this.activateMarker(marker, infowindow);
                    // case : 1 selected brand
                } else {
                    // case already selected : un-select
                    if (marker.isActive) {
                        marker.isActive = false;
                        infowindow.close();
                        this.showVouchers = false;
                        this.displayedVouchers = [];
                        // case tap on other brand with other brand already open
                    } else {
                        _.forEach(this.markers, (m) => {
                            m.isActive = false;
                        });
                        _.forEach(this.infoWindows, (i: google.maps.InfoWindow) => {
                            i.close();
                        });
                        this.activateMarker(marker, infowindow);
                    }
                }
            });
    }

    public activateMarker(marker: CustomMarker, infowindow: google.maps.InfoWindow) {
        marker.isActive = true;
        this.displayedVouchers = _.filter(this.vouchers, (v: RewardCardModel) => {
            return marker.associatedVouchers.includes(v.uuid) && v.isRetail;
        });
        setTimeout(() => {
            this.map.panTo(marker.position_);
        }, 200);
        setTimeout(() => {
            this.showVouchers = true;
        }, 400);
        infowindow.open(this.map, marker);
    }

    public onMapClicked() {
        this.zone.run(
            () => {
                _.forEach(this.markers, (m) => {
                    m.isActive = false;
                });
                _.forEach(this.infoWindows, (i: google.maps.InfoWindow) => {
                    i.close();
                })
                this.showVouchers = false;
                this.displayedVouchers = [];

            }
        )
    }
    public reCenter() {
        if (this.userLoc) {
            this.map.panTo(this.userLoc);
            this.map.setZoom(this.enabledGPS ? 14 : 5);
            this.onMapClicked();
        }
    }
    public filter(selectedFilters: any) {
        let filtersPageModal = this.modalCtrl.create(FiltersPage);
        filtersPageModal.onDidDismiss((noChange: boolean) => {
            if (!noChange) {
                this.refresh();
            }
        });
        filtersPageModal.present();
    }
    public chkFilter() {
        let chkFilter: boolean = false;
        if (this.filter_.chkCategories) {
            for (var k in this.filter_.chkCategories) {
                if (this.filter_.chkCategories.hasOwnProperty(k)) {
                    if (this.filter_.chkCategories[k]) {
                        chkFilter = true
                        break;
                    }
                }
            }
        }
        return chkFilter;
    }
    public transformDistance(value: number): string {
        if (value == null) { return ''; }
        value *= 1000;

        let lang: string = this.db.instantModel.athlete.settings.language.locale;
        if (lang !== 'en') {
            return (value >= 1000) ? (value / 1000).toFixed(0) + ' km' : value.toFixed(0) + ' m';
        } else {
            let m2mi = 0.00062137; // convertion meters to miles
            let m2yd = 1.0936;     // convertion meters to yards
            if (value * m2mi < 1) {
                return Math.floor(value * m2yd) + ' yd'; // yards
            } else {
                return (((value * m2mi) * 100) / 100).toFixed(2) + ' mi';
            }
        }
    }
    public navigate() {
        let active = _.filter(this.markers, (m) => {
            return m.isActive;
        });
        this.launchNavigator.navigate([active[0].position_.lat(), active[0].position_.lng()]);
    }
}