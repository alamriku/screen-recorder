class FetchApiClient {
    constructor(bearerToken) {
        this.bearerToken = bearerToken;
        this.baseUrl = process.env.BASE_URL; // You can set a base URL if needed
        this.options = {
            headers: {
                'Authorization': `Bearer ${this.bearerToken}`,
                'Content-Type': 'application/json'
            }
        };
    }

    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl;
        return this;
    }

    setHeaders(headers) {
        this.options.headers = { ...this.options.headers, ...headers };
        return this;
    }

    get(url) {
        return this.request('GET', url);
    }

    post(url, data) {
        this.options.body = JSON.stringify(data);
        return this.request('POST', url);
    }

    // Add other HTTP methods as needed (e.g., PUT, DELETE)

    async request(method, url) {
        const requestOptions = {
            ...this.options,
            method,
        };

        try {
            const response = await fetch(`${this.baseUrl}${url}`, requestOptions);

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            return response.json();
        } catch (error) {
            console.error('Error:', error);
            throw error;  // Re-throw the error for handling at a higher level
        }
    }
}

export default FetchApiClient;
