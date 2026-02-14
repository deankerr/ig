export default {
  development: {
    baseDomain: 'ig-dev.orb.town',
  },
  production: {
    'prod-1': {
      server: {
        domain: 'ig-1.orb.town',
      },
      web: {
        domain: 'console.ig-1.orb.town',
      },
    },

    'prod-2': {
      server: {
        domain: 'ig.orb.town',
      },
      web: {
        domain: 'console.ig.orb.town',
      },
    },
  },
}
