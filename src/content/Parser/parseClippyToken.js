import CookieParser from "../utils/cookie";
import {CUSTOMER_ACCESS_TOKEN} from "../../const";

class ParserOnClippy {

    static parseTokenFromCookie() {
        let cookie = CookieParser.parse();
        console.log(CookieParser.parse(), cookie[CUSTOMER_ACCESS_TOKEN], CUSTOMER_ACCESS_TOKEN)
        return cookie[CUSTOMER_ACCESS_TOKEN];
    }

    static setTokenOnStorage() {
        chrome.storage.sync.set({[CUSTOMER_ACCESS_TOKEN]: this.parseTokenFromCookie()}).then((result) => {
            console.log("token set");
        });
    }
}

ParserOnClippy.setTokenOnStorage();
