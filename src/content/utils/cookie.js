class CookieParser {
    static parse() {
        const cookieObj = {};
        document.cookie.split(';').forEach(cookie => {
            const [key, value] = cookie.split('=').map(item => item.trim());
            cookieObj[key] = decodeURIComponent(value);
        });
        return cookieObj;
    }
}

export default CookieParser;
