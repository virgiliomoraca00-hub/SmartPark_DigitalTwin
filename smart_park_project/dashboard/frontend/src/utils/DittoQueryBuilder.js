/**
 * Utility per costruire query verso Eclipse Ditto in modo sicuro e paginato.
 */
class DittoQueryBuilder {
  constructor(baseUrl = "", authHeader = "Basic " + btoa("ditto:ditto")) {
    this.baseUrl = baseUrl;
    this.authHeader = authHeader;
    this.conditions = [];
    this.sortRule = null;
    this.fieldsRule = "thingId,attributes,features/sensors/properties";
    this.pageSize = null;
    this.extraParams = {};
  }

  // Cerca un tipo specifico di dispositivo negli attributi
  filterByType(deviceType) {
    this.conditions.push(`eq(attributes/type,"${deviceType}")`);
    return this;
  }

  // Verifica che un dato strutturale esista (attributi)
  hasAttribute(attributeKey) {
    this.conditions.push(`exists(attributes/${attributeKey})`);
    return this;
  }

  // Verifica che un dato dinamico esista (telemetria in properties)
  hasTelemetry(sensorKey) {
    this.conditions.push(`exists(features/sensors/properties/${sensorKey})`);
    return this;
  }

  // Scegli campi limitati per le query leggere
  selectFields(fieldsArray) {
    this.fieldsRule = fieldsArray.join(',');
    return this;
  }

  // Aggiungi un parametro extra (es. option=size(200) per SSE)
  withParam(key, value) {
    this.extraParams[key] = value;
    return this;
  }

  // Imposta max elementi per pagina
  setPageSize(size) {
    this.pageSize = size;
    return this;
  }

  // Filtra per un valore specifico (es. battito > 100)
  telemetryGreaterThan(sensorKey, value) {
    this.conditions.push(`gt(features/sensors/properties/${sensorKey},${value})`);
    return this;
  }

  // Ordinamento: accetta 'asc' o 'desc' e il path
  sortBy(path, direction = 'asc') {
    // Codifica sicura dei simboli + e -
    const symbol = direction === 'asc' ? '%2B' : '%2D';
    this.sortRule = `${symbol}${path}`;
    return this;
  }

  // Resetta le opzioni per riusare l'istanza se serve
  reset() {
    this.conditions = [];
    this.sortRule = null;
    this.fieldsRule = "thingId,attributes,features/sensors/properties";
    this.pageSize = null;
    this.extraParams = {};
    return this;
  }

  // Ottieni URL senza eseguire la fetch, utile per i Server-Sent Events o chiamate custom
  buildUrl(cursor = null) {
    let rqlString = "";
    if (this.conditions.length === 1) {
      rqlString = this.conditions[0];
    } else if (this.conditions.length > 1) {
      rqlString = `and(${this.conditions.join(',')})`;
    }

    // URL Encoding sicuro della stringa RQL
    const encodedFilter = rqlString ? encodeURIComponent(rqlString) : "";
    
    // Costruzione dell'URL finale
    let url = `${this.baseUrl}/ditto/2/things?`;
    let queryParams = [];

    if (encodedFilter) queryParams.push(`filter=${encodedFilter}`);
    if (this.fieldsRule) queryParams.push(`fields=${this.fieldsRule}`);
    if (this.pageSize) queryParams.push(`size=${this.pageSize}`);
    if (this.sortRule) queryParams.push(`sort=${this.sortRule}`);
    if (cursor) queryParams.push(`cursor=${cursor}`);

    for (const [key, val] of Object.entries(this.extraParams)) {
      queryParams.push(`${key}=${val}`);
    }

    return url + queryParams.join('&');
  }

  // Esecuzione della query con supporto ai cursori e opzioni proxy fetch (es. per AbortController)
  async execute(cursor = null, fetchOptions = {}) {
    const url = this.buildUrl(cursor);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json',
        ...(fetchOptions.headers || {})
      },
      ...fetchOptions,
      signal: fetchOptions.signal
    });

    if (!response.ok) {
      throw new Error(`Errore Ditto: ${response.status}`);
    }

    return await response.json();
  }
}

export default DittoQueryBuilder;
