package configs

import (
	"github.com/spf13/viper"
)

type Config struct {
	App      AppConfig
	Database DatabaseConfig
}

type AppConfig struct {
	Name string
	Port string
	Env  string
	Cors CorsConfig
}

type CorsConfig struct {
	AllowOrigins string
	AllowMethods string
	AllowHeaders string
}

type DatabaseConfig struct {
	Connection      string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime int
}

func Load() *Config {
	// Read .env file; silently ignore if missing (Docker injects vars directly).
	viper.SetConfigFile(".env")
	viper.SetConfigType("env")
	_ = viper.ReadInConfig()

	// AutomaticEnv makes real env vars take precedence over .env file values.
	viper.AutomaticEnv()

	viper.SetDefault("APP_PORT", "8080")
	viper.SetDefault("APP_NAME", "cmu-review-backend")
	viper.SetDefault("APP_ENV", "development")
	viper.SetDefault("APP_CORS_ALLOW_ORIGINS", "*")
	viper.SetDefault("APP_CORS_ALLOW_METHODS", "GET,POST,PUT,DELETE,OPTIONS")
	viper.SetDefault("APP_CORS_ALLOW_HEADERS", "Origin,Content-Type,X-Request-ID")
	viper.SetDefault("DATABASE_MAX_OPEN_CONNS", 25)
	viper.SetDefault("DATABASE_MAX_IDLE_CONNS", 10)
	viper.SetDefault("DATABASE_CONN_MAX_LIFETIME", 300)

	port := viper.GetString("PORT")
	if port == "" {
		port = viper.GetString("APP_PORT")
	}

	return &Config{
		App: AppConfig{
			Name: viper.GetString("APP_NAME"),
			Port: port,
			Env:  viper.GetString("APP_ENV"),
			Cors: CorsConfig{
				AllowOrigins: viper.GetString("APP_CORS_ALLOW_ORIGINS"),
				AllowMethods: viper.GetString("APP_CORS_ALLOW_METHODS"),
				AllowHeaders: viper.GetString("APP_CORS_ALLOW_HEADERS"),
			},
		},
		Database: DatabaseConfig{
			Connection:      viper.GetString("DATABASE_URL"),
			MaxOpenConns:    viper.GetInt("DATABASE_MAX_OPEN_CONNS"),
			MaxIdleConns:    viper.GetInt("DATABASE_MAX_IDLE_CONNS"),
			ConnMaxLifetime: viper.GetInt("DATABASE_CONN_MAX_LIFETIME"),
		},
	}
}
