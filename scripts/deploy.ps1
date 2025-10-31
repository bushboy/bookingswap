# Production deployment script for Booking Swap Platform (PowerShell)
param(
    [string]$Environment = "production",
    [bool]$BackupEnabled = $true,
    [int]$HealthCheckTimeout = 300
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"

Write-Host "🚀 Starting deployment for environment: $Environment" -ForegroundColor $Green

# Check prerequisites
function Test-Prerequisites {
    Write-Host "📋 Checking prerequisites..." -ForegroundColor $Yellow
    
    # Check if Docker is installed and running
    try {
        docker --version | Out-Null
        docker info | Out-Null
    }
    catch {
        Write-Host "❌ Docker is not installed or not running" -ForegroundColor $Red
        exit 1
    }
    
    # Check if Docker Compose is installed
    try {
        docker-compose --version | Out-Null
    }
    catch {
        Write-Host "❌ Docker Compose is not installed" -ForegroundColor $Red
        exit 1
    }
    
    # Check if environment file exists
    if (-not (Test-Path ".env.$Environment")) {
        Write-Host "❌ Environment file .env.$Environment not found" -ForegroundColor $Red
        exit 1
    }
    
    Write-Host "✅ Prerequisites check passed" -ForegroundColor $Green
}

# Create backup
function New-Backup {
    if ($BackupEnabled) {
        Write-Host "💾 Creating backup..." -ForegroundColor $Yellow
        
        # Create backup directory
        $BackupDir = "backups\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
        
        # Backup database
        $postgresRunning = docker-compose -f docker-compose.prod.yml ps postgres | Select-String "Up"
        if ($postgresRunning) {
            Write-Host "Backing up database..."
            docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U $env:POSTGRES_USER $env:POSTGRES_DB > "$BackupDir\database.sql"
        }
        
        # Backup volumes
        Write-Host "Backing up volumes..."
        docker run --rm -v booking-swap-platform_postgres_data:/data -v ${PWD}\${BackupDir}:/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
        docker run --rm -v booking-swap-platform_redis_data:/data -v ${PWD}\${BackupDir}:/backup alpine tar czf /backup/redis_data.tar.gz -C /data .
        
        Write-Host "✅ Backup created in $BackupDir" -ForegroundColor $Green
    }
}

# Build and deploy
function Start-Deploy {
    Write-Host "🔨 Building and deploying services..." -ForegroundColor $Yellow
    
    # Copy environment file
    Copy-Item ".env.$Environment" ".env" -Force
    
    # Pull latest images
    docker-compose -f docker-compose.prod.yml pull
    
    # Build custom images
    docker-compose -f docker-compose.prod.yml build --no-cache
    
    # Stop existing services
    docker-compose -f docker-compose.prod.yml down
    
    # Start services
    docker-compose -f docker-compose.prod.yml up -d
    
    Write-Host "✅ Services deployed" -ForegroundColor $Green
}

# Health check
function Test-Health {
    Write-Host "🏥 Performing health checks..." -ForegroundColor $Yellow
    
    $elapsed = 0
    $interval = 10
    
    while ($elapsed -lt $HealthCheckTimeout) {
        try {
            # Check backend health
            $backendResponse = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5
            if ($backendResponse.StatusCode -eq 200) {
                Write-Host "✅ Backend is healthy" -ForegroundColor $Green
                
                # Check frontend health
                $frontendResponse = Invoke-WebRequest -Uri "http://localhost:80/health" -UseBasicParsing -TimeoutSec 5
                if ($frontendResponse.StatusCode -eq 200) {
                    Write-Host "✅ Frontend is healthy" -ForegroundColor $Green
                    Write-Host "🎉 Deployment successful!" -ForegroundColor $Green
                    return $true
                }
            }
        }
        catch {
            # Continue waiting
        }
        
        Write-Host "Waiting for services to be healthy... ($elapsed s/$HealthCheckTimeout s)"
        Start-Sleep $interval
        $elapsed += $interval
    }
    
    Write-Host "❌ Health check failed after $HealthCheckTimeout s" -ForegroundColor $Red
    Write-Host "📋 Service status:" -ForegroundColor $Yellow
    docker-compose -f docker-compose.prod.yml ps
    
    Write-Host "📋 Service logs:" -ForegroundColor $Yellow
    docker-compose -f docker-compose.prod.yml logs --tail=50
    
    return $false
}

# Rollback function
function Start-Rollback {
    Write-Host "🔄 Rolling back deployment..." -ForegroundColor $Yellow
    
    # Stop current services
    docker-compose -f docker-compose.prod.yml down
    
    # Restore from backup if available
    if (Test-Path "backups") {
        $LatestBackup = Get-ChildItem "backups" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($LatestBackup) {
            Write-Host "Restoring from backup: $($LatestBackup.Name)"
            
            # Restore database
            if (Test-Path "backups\$($LatestBackup.Name)\database.sql") {
                docker-compose -f docker-compose.prod.yml up -d postgres
                Start-Sleep 10
                Get-Content "backups\$($LatestBackup.Name)\database.sql" | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U $env:POSTGRES_USER -d $env:POSTGRES_DB
            }
            
            # Restore volumes
            if (Test-Path "backups\$($LatestBackup.Name)\postgres_data.tar.gz") {
                docker run --rm -v booking-swap-platform_postgres_data:/data -v ${PWD}\backups\$($LatestBackup.Name):/backup alpine tar xzf /backup/postgres_data.tar.gz -C /data
            }
            
            if (Test-Path "backups\$($LatestBackup.Name)\redis_data.tar.gz") {
                docker run --rm -v booking-swap-platform_redis_data:/data -v ${PWD}\backups\$($LatestBackup.Name):/backup alpine tar xzf /backup/redis_data.tar.gz -C /data
            }
        }
    }
    
    Write-Host "✅ Rollback completed" -ForegroundColor $Green
}

# Cleanup function
function Start-Cleanup {
    Write-Host "🧹 Cleaning up..." -ForegroundColor $Yellow
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    Write-Host "✅ Cleanup completed" -ForegroundColor $Green
}

# Main deployment flow
function Main {
    Test-Prerequisites
    New-Backup
    
    Start-Deploy
    
    if (Test-Health) {
        Start-Cleanup
        Write-Host "🎉 Deployment completed successfully!" -ForegroundColor $Green
        Write-Host "📊 Access monitoring at: http://localhost:3000" -ForegroundColor $Green
        Write-Host "🔍 Access logs at: http://localhost:3100" -ForegroundColor $Green
    }
    else {
        Write-Host "❌ Deployment failed" -ForegroundColor $Red
        $rollback = Read-Host "Do you want to rollback? (y/N)"
        if ($rollback -eq "y" -or $rollback -eq "Y") {
            Start-Rollback
        }
        exit 1
    }
}

# Handle script interruption
trap {
    Write-Host "`n❌ Deployment interrupted" -ForegroundColor $Red
    exit 1
}

# Run main function
Main