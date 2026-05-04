/**
 * Utility per costruire query verso Eclipse Ditto Search API.
 *
 * IMPORTANTE — Endpoint usati da Ditto:
 *   /api/2/things          → Things API (no size, no cursor, no filtri RQL)
 *   /api/2/search/things   → Search API (supporta size, cursor, filtri RQL)
 *
 * Questo builder genera URL per la Search API perché è l'unica
 * che supporta paginazione (size + cursor) e filtri RQL.
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

  // Aggiungi un parametro extra
  withParam(key, value) {
    this.extraParams[key] = value;
    return this;
  }

  // Imposta max elementi per pagina (max assoluto Ditto: 200)
  setPageSize(size) {
    this.pageSize = Math.min(size, 200);
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

  // Ottieni URL senza eseguire la fetch — Search API endpoint
  buildUrl(cursor = null) {
    let rqlString = "";
    if (this.conditions.length === 1) {
      rqlString = this.conditions[0];
    } else if (this.conditions.length > 1) {
      rqlString = `and(${this.conditions.join(',')})`;
    }

    // URL Encoding sicuro della stringa RQL
    const encodedFilter = rqlString ? encodeURIComponent(rqlString) : "";
    
    // Costruzione dell'URL finale — Search API
    let url = `${this.baseUrl}/ditto/2/search/things?`;
    let queryParams = [];

    if (encodedFilter) queryParams.push(`filter=${encodedFilter}`);
    if (this.fieldsRule) queryParams.push(`fields=${encodeURIComponent(this.fieldsRule)}`);
    if (this.sortRule) queryParams.push(`sort=${this.sortRule}`);

    // IMPORTANTE: Ditto ignora size e cursor come parametri standalone.
    // Devono essere passati tramite il parametro "option" con la sintassi RQL:
    //   option=size(N)           → imposta page size
    //   option=size(N),cursor(X) → pagina successiva
    const optionParts = [];
    if (this.pageSize) optionParts.push(`size(${this.pageSize})`);
    if (cursor)        optionParts.push(`cursor(${cursor})`);
    if (optionParts.length) queryParams.push(`option=${optionParts.join(',')}`);

    for (const [key, val] of Object.entries(this.extraParams)) {
      queryParams.push(`${key}=${encodeURIComponent(val)}`);
    }

    return url + queryParams.join('&');
  }

  // Esegue una singola pagina (per paginazione manuale con cursore)
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

  /**
   * Scarica TUTTI i things iterando automaticamente sui cursori.
   * Usa size=200 (massimo Ditto) per minimizzare le chiamate.
   * Ritorna un array piatto di tutti gli items.
   */
  async executeAll(fetchOptions = {}) {
    if (!this.pageSize) this.setPageSize(200);

    const allItems = [];
    let cursor = null;
    let maxPages = 50; // guardia anti-loop infinito

    do {
      const data = await this.execute(cursor, fetchOptions);
      const items = Array.isArray(data) ? data : (data.items || []);
      
      // Se pagina vuota → fine dei risultati
      if (items.length === 0) break;
      
      allItems.push(...items);
      cursor = data.cursor ?? null;
      maxPages--;
    } while (cursor && maxPages > 0);

    return allItems;
  }
}

export default DittoQueryBuilder;
