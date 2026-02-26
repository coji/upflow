env "local" {
  src = "file://db/shared.sql"
  dev = "sqlite://dev?mode=memory"
  migration {
    dir = "file://db/migrations/shared"
  }
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}

env "tenant" {
  src = "file://db/tenant.sql"
  dev = "sqlite://dev?mode=memory"
  migration {
    dir = "file://db/migrations/tenant"
  }
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}
