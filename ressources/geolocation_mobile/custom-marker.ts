import { } from '@types/googlemaps';

export class CustomMarker extends google.maps.OverlayView {
    position_: google.maps.LatLng;
    brandLogo_: string;
    map_: any;
    div_: any;
    public isActive?: boolean;
    public associatedVouchers?: any;
    public go = false;
    constructor(
        latlng: google.maps.LatLng,
        public map,
        brandLogo
    ) {
        super();
        // Initialize all properties.
        this.map_ = map;
        this.brandLogo_ = brandLogo;
        this.position_ = latlng;
        // Define a property to hold the image's div. We'll
        // actually create this div upon receipt of the onAdd()
        // method so we'll leave it null for now.
        this.div_ = null;
        // Explicitly call setMap on this overlay.
        this.setMap(map);
        this.set;
    }

    imageExists(url, callback) {
        let img = new Image();
        img.onload = () => { callback(true); }
        img.onerror = () => { callback(false); }
        img.src = url;
    }

    draw() {
        var self = this;

        var div = this.div_;

        if (!div) {

            div = this.div_ = document.createElement('div');

            div.className = 'marker';

            div.style.position = 'absolute';
            div.style.display = 'flex';
            const img = document.createElement('img');
            this.imageExists(this.brandLogo_, (result) => {
                if (result){
                    img.src = this.brandLogo_;
                }
            });
            img.style.width = '48px';
            div.style.backgroundColor = '#fff';
            div.style.border = '1px lightgray solid'
            div.style.borderRadius = '4px';
            div.style['align-items'] = 'center';
            img.style.padding = '4px';
            img.style.height = '48px';
            img.style.position = 'relative';
            img.style['objectFit'] = 'contain';
            img.style['objectPosition'] = 'center';
            div.appendChild(img);

            this.getPanes().overlayMouseTarget.appendChild(div);
            google.maps.event.addDomListener(div, "click", (event) => {
                google.maps.event.trigger(self, "click");
            });

            let panes: google.maps.MapPanes = this.getPanes();
            panes.overlayImage.appendChild(div);
        }
        let point = this.getProjection().fromLatLngToDivPixel(this.position_);
        if (point) {
            div.style.left = (point.x - 20) + 'px';
            div.style.top = (point.y - 20) + 'px';
        }
    };

    // The onRemove() method will be called automatically from the API if
    // we ever set the overlay's map property to 'null'.
    onRemove() {
        this.div_.parentNode.removeChild(this.div_);
        this.div_ = null;
    };

}