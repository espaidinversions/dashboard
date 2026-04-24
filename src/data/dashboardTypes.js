/**
 * Shared dashboard / API payload shapes.
 *
 * These describe the plain objects moved between `src/db.js`, the browser
 * state, and the Supabase tables.
 */

/**
 * @typedef {Object} CapitalCallRow
 * @property {string} [id]
 * @property {string} fons
 * @property {string} tipus
 * @property {string} cat
 * @property {string} data
 * @property {string} mes
 * @property {number} any
 * @property {string} fy
 * @property {string} vcpe
 * @property {string} est
 * @property {number} eur
 * @property {string} divisa
 * @property {number|null} [recallable]
 * @property {number|null} [non_recallable]
 * @property {number|null} [from_recallable]
 */

/**
 * @typedef {Object} FundMetaRow
 * @property {string} [id]
 * @property {string} fons
 * @property {number|null} tvpi
 */

/**
 * @typedef {Object} PrivateEntity
 * @property {string} id
 * @property {"company"|"vehicle"} kind
 * @property {string} canonicalName
 * @property {string|null} [sourceName]
 * @property {string|null} [workbookName]
 * @property {string|null} [matchType]
 */

/**
 * @typedef {Object} PipelineDeal
 * @property {number} id
 * @property {string} name
 * @property {number} amount
 * @property {string} currency
 * @property {string} geography
 * @property {string} strategy
 * @property {string} sector
 * @property {string} status
 * @property {string} canal
 * @property {boolean} active
 * @property {string|null} [estimatedClosing]
 */

/**
 * @typedef {Object} PipelineDealRow
 * @property {number} id
 * @property {string} name
 * @property {number} amount
 * @property {string} currency
 * @property {string} geography
 * @property {string} strategy
 * @property {string} sector
 * @property {string} status
 * @property {string} canal
 * @property {boolean} active
 * @property {string|null} estimated_closing
 */

/**
 * @typedef {Object} PortfolioCompany
 * @property {string} id
 * @property {string} nom
 * @property {string} tipus
 * @property {string|null} [segment]
 * @property {string|null} [entrepreneurs]
 * @property {string|null} [origen]
 * @property {string|null} [geo]
 * @property {number|null} [ticket]
 * @property {number|null} [tvpi]
 * @property {number|null} [rvpiEur]
 * @property {number|null} [dpiEur]
 * @property {number|null} [rev]
 * @property {number|null} [ebitda]
 * @property {number|null} [dfn]
 * @property {number|null} [grossEV]
 * @property {number|null} [multEntry]
 * @property {string|null} [dataCompr]
 * @property {number|null} [mesosOperant]
 * @property {boolean} [isMock]
 * @property {Array<Object>} [quarters]
 * @property {string|null} [sourceName]
 * @property {string|null} [workbookName]
 * @property {string|null} [matchType]
 */

/**
 * @typedef {Object} PortfolioCompanyRow
 * @property {number} [row_id]
 * @property {string} entity_id
 * @property {string} nom
 * @property {string} tipus
 * @property {string|null} segment
 * @property {string|null} entrepreneurs
 * @property {string|null} origen
 * @property {string|null} geo
 * @property {number|null} ticket
 * @property {number|null} tvpi
 * @property {number|null} rvpi_eur
 * @property {number|null} dpi_eur
 * @property {number|null} rev
 * @property {number|null} ebitda
 * @property {number|null} dfn
 * @property {number|null} gross_ev
 * @property {number|null} mult_entry
 * @property {string|null} data_compr
 * @property {number|null} mesos_operant
 * @property {boolean} is_mock
 * @property {Array<Object>} [quarters]
 */

/**
 * @typedef {Object} Searcher
 * @property {number} [id]
 * @property {string} nom
 * @property {string} tipus
 * @property {string|null} [modalitat]
 * @property {string|null} [geo]
 * @property {number|null} [statusScreeningCode]
 * @property {string|null} [statusScreening]
 * @property {number|null} [statusCercaCode]
 * @property {string|null} [statusCerca]
 * @property {number|null} [statusAdquisicioCode]
 * @property {string|null} [statusAdquisicio]
 * @property {string|null} [formEntrada]
 * @property {string|null} [introPer]
 * @property {string|null} [companiaAdquirida]
 * @property {string} [searcher1]
 * @property {string} [searcher2]
 * @property {string} [escola1]
 * @property {string} [escola2]
 * @property {number|null} [ticket]
 * @property {string|null} [web]
 * @property {string|null} [comentaris]
 * @property {number|null} [tvpi]
 * @property {string|null} [dataInici]
 * @property {string|null} [databaseIntroDate]
 * @property {string|null} [dataCompr]
 * @property {number|null} [mesosCercant]
 * @property {number|null} [irr]
 * @property {number|null} [dpi]
 * @property {number|null} [equityStake]
 * @property {string|null} [nif]
 * @property {boolean} [isMock]
 */

/**
 * @typedef {Object} SearcherRow
 * @property {number} [id]
 * @property {string} nom
 * @property {string} tipus
 * @property {string|null} modalitat
 * @property {string|null} geo
 * @property {number|null} status_screening_code
 * @property {string|null} status_screening
 * @property {number|null} status_cerca_code
 * @property {string|null} status_cerca
 * @property {number|null} status_adquisicio_code
 * @property {string|null} status_adquisicio
 * @property {string|null} form_entrada
 * @property {string|null} intro_per
 * @property {string|null} companyia_adquirida
 * @property {string|null} searcher1
 * @property {string|null} searcher2
 * @property {string|null} escola1
 * @property {string|null} escola2
 * @property {number|null} ticket
 * @property {string|null} web
 * @property {string|null} comentaris
 * @property {number|null} tvpi
 * @property {string|null} data_inici
 * @property {string|null} database_intro_date
 * @property {string|null} data_compr
 * @property {number|null} mesos_cercant
 * @property {number|null} irr
 * @property {number|null} dpi
 * @property {number|null} equity_stake
 * @property {string|null} nif
 * @property {boolean} is_mock
 */

/**
 * @typedef {Object} DashboardBundle
 * @property {CapitalCallRow[]|null} [rawCC]
 * @property {PipelineDeal[]|null} [funds0]
 * @property {PortfolioCompany[]|null} [companies]
 * @property {Searcher[]|null} [searchers]
 * @property {FundMetaRow[]|null} [fundMeta]
 * @property {PrivateEntity[]|null} [privateEntities]
 */

export {};
