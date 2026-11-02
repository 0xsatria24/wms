using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wms.Core.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OperationalDocumentDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ApprovedAt",
                table: "OperationalDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CompletedAt",
                table: "OperationalDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "OperationalDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "DocumentDate",
                table: "OperationalDocuments",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ScheduledDate",
                table: "OperationalDocuments",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StartedAt",
                table: "OperationalDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "SubmittedAt",
                table: "OperationalDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "UpdatedAt",
                table: "OperationalDocuments",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "OperationalDocuments");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "OperationalDocuments");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "OperationalDocuments");

            migrationBuilder.DropColumn(
                name: "DocumentDate",
                table: "OperationalDocuments");

            migrationBuilder.DropColumn(
                name: "ScheduledDate",
                table: "OperationalDocuments");

            migrationBuilder.DropColumn(
                name: "StartedAt",
                table: "OperationalDocuments");

            migrationBuilder.DropColumn(
                name: "SubmittedAt",
                table: "OperationalDocuments");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "OperationalDocuments");
        }
    }
}
